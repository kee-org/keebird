/*
KeeFox - Allows Firefox to communicate with KeePass (via the KeePassRPC KeePass-plugin)
Copyright 2008-2016 Chris Tomlinson <keefox@christomlinson.name>

session.js manages the low-level transport connection between this
client and an KeePassRPC server.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/
"use strict";

let Cc = Components.classes;
let Ci = Components.interfaces;
let Cu = Components.utils;

var EXPORTED_SYMBOLS = ["session"];

const { KeeFoxLog } = ChromeUtils.import("resource://kfmod/KFLogger.js");

var log = KeeFoxLog;

function session()
{
    this.reconnectionAttemptFrequency = 2000;
    this.connectionTimeout = 10000; // short timeout for connections
    this.activityTimeout = 3600000; // long timeout for activity
    this.connectLock = false; // protect the connect function so only one event
                        // thread (e.g. timer) can execute it at the same time
    this.fastRetries = 0;

    this.webSocketPort = 12546;
    this.webSocketHost = "127.0.0.1";
    this.webSocketURI = "ws://" + this.webSocketHost + ":" + this.webSocketPort;
    this.webSocket = null;
    
    // We use a HTTP channel for basic polling of the port listening status of
    // the KPRPC server because it's quick and not subject to the rate limiting
    // of webSocket connections as per Firefox bug #711793 and RFC 7.2.3:
    // http://tools.ietf.org/html/rfc6455#section-7.2.3
    // See KeeFox issue #189 for connection algorithm overview:
    // https://github.com/luckyrat/KeeFox/issues/189#issuecomment-23635771
    this.httpChannel = null;
    this.httpChannelURI = "http://" + this.webSocketHost + ":" + this.webSocketPort;
}

(function() {

    this.reconnectTimer = null;
    this.onConnectDelayTimer = null;
    this.connectionProhibitedUntil = new Date(0);
    this.speculativeWebSocketAttemptProhibitedUntil = new Date(0);

    // It would be neater to pause this timer when we know we are connected
    // but the overhead is so minimal (and so essential in most cases - i.e.
    // all times when the user does not have KeePass open) that we just
    // leave it running to avoid complications that would come from trying
    // to synchronise the state of the timer with the connection state.
    this.reconnectSoon = function()
    {
        log.debug("Creating a reconnection timer.");
         // Create a timer 
         this.reconnectTimer = Components.classes["@mozilla.org/timer;1"]
                    .createInstance(Components.interfaces.nsITimer);
         
         this.reconnectTimer.init(this,
            this.reconnectionAttemptFrequency,
            Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
    };
    
    this.reconnectVerySoon = function()
    {
        log.debug("Creating a fast reconnection timer.");
        
        this.fastRetries = 40; // 10 seconds of more frequent connection attempts
        
         // Create a timer 
         this.reconnectTimer = Components.classes["@mozilla.org/timer;1"]
                    .createInstance(Components.interfaces.nsITimer);
         
         this.reconnectTimer.init(this,
            250,
            Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
    };

    this.webSocketTimer;

    this.tryToconnectToWebsocket = function() {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
        var window = wm.getMostRecentWindow("navigator:browser") ||
            wm.getMostRecentWindow("mail:3pane");
        var rpc = window.keefox_org.KeePassRPC;

        log.debug("Attempting to connect to RPC server webSocket.");
        var connectResult = rpc.connect();
        if (connectResult == "alive")
            log.debug("Connection already established.");
        if (connectResult == "locked")
            log.debug("Connection attempt already underway.");
    };

    this.httpConnectionAttemptCallback = function() {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
        var window = wm.getMostRecentWindow("navigator:browser") ||
            wm.getMostRecentWindow("mail:3pane");
        var rpc = window.keefox_org.KeePassRPC;

        // We can't try to connect straight away because the old HTTP ephemeral
        // TCP port is still hanging around during this onClose callback and on some
        // machines, ephemeral ports flout IANA guidelines including using
        // KeePassRPC's TCP port. If we tried to connect now, we risk connecting
        // back to Firefox and causing a deadlock. A small delay gives Firefox
        // a chance to cleanly close the old port
        rpc.webSocketTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        rpc.webSocketTimer.initWithCallback(rpc.tryToconnectToWebsocket,
            50, Components.interfaces.nsITimer.TYPE_ONE_SHOT);  
    };
    
    // Initiates a connection to the KPRPC server.
    this.connect = function()
    {
        if (this.connectLock)
            return "locked";
        if (this.webSocket !== undefined && this.webSocket !== null && this.webSocket.readyState != 3)
            return "alive";
        if (this.connectionProhibitedUntil.getTime() > (new Date()).getTime())
            return "locked";

        log.debug("Trying to open a webSocket connection");

        this.connectLock = true;
        try
        {
            // Use the app's hidden window to establish the webSocket.
            // One day we should be able to use a worker instead but webSocket
            // support in workers is not an option as of FF17 ESR and I suspect
            // that a websocket created from a specific window will leak a ref to that window. 
            var window = Components.classes["@mozilla.org/appshell/appShellService;1"]
                             .getService(Components.interfaces.nsIAppShellService)
                             .hiddenDOMWindow;
            this.webSocket = new window.WebSocket(this.webSocketURI);
        } catch (ex)
        {
            // This shouldn't happen much - most errors will be caught in the onerror function below
            this.connectLock = false;
            return;
        }

        this.webSocket.onopen = function (event) {
            log.info("Websocket connection opened");
            
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
            var window = wm.getMostRecentWindow("navigator:browser") ||
                        wm.getMostRecentWindow("mail:3pane");
            window.keefox_org.KeePassRPC.connectLock = false;

            // Start the SRP or shared key negotiation
            window.keefox_org.KeePassRPC.setup();
        };
        this.webSocket.onmessage = function (event) {
            log.debug("received message from web socket");

            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
            var window = wm.getMostRecentWindow("navigator:browser") ||
                        wm.getMostRecentWindow("mail:3pane");

            let obj = JSON.parse(event.data);
                
            // if we failed to parse an object from the JSON    
            if (!obj)
            {
                log.error("received bad message from web socket. Can't parse from JSON.");
                return;
            }
            window.keefox_org.KeePassRPC.receive(obj);
        };
        this.webSocket.onerror = function (event) {
            log.debug("Websocket connection error");
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
            var window = wm.getMostRecentWindow("navigator:browser") ||
                        wm.getMostRecentWindow("mail:3pane");
            window.keefox_org.KeePassRPC.connectLock = false;

            // webSocket spec says that we can't know why there was an error
            log.debug("Websocket connection error end");
        };
        this.webSocket.onclose = function (event) {
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
            var window = wm.getMostRecentWindow("navigator:browser") ||
                        wm.getMostRecentWindow("mail:3pane");
            
            log.debug("Notifying interested observers that the websocket has closed");
            Components.classes["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService)
              .notifyObservers(null, "KPRPCConnectionClosed", null);
            window.keefox_org._pauseKeeFox();
            log.debug("Websocket connection closed");
        };

    };

    // nsObserver
    this.observe = function (timer, topic, data)
        {
            if (topic == "timer-callback")
            {
                var rpc = this;
            
                if (rpc.fastRetries > 0)
                {
                    // count this as a fast retry even if it was triggered from
                    // standard retry timer and even if we are already connected
                    rpc.fastRetries--; 
            
                    if (rpc.fastRetries <= 0)
                    {
                        if (rpc.reconnectTimer != null)
                            rpc.reconnectTimer.cancel();
                        rpc.reconnectSoon();
                    }
                }

                // Check we are allowed to connect
                if (rpc.connectionProhibitedUntil.getTime() > (new Date()).getTime())
                    return;

                // Check we're not in the middle of trying to connect to the websocket
                if (rpc.connectLock)
                    return;

                // Check current websocket connection state. No point in trying 
                // if we know we're already successfully connected
                if (rpc.webSocket !== undefined && rpc.webSocket !== null && rpc.webSocket.readyState != 3)
                    return;

                // Every 73 seconds we can try to connect to the WebSocket directly.
                // This allows for the 60 second web socket connection block timeout,
                // a 10 second connection timeout, 1 second for the extra delay introduced
                // by the web socket connection block and 2 seconds for luck (we really
                // don't want this to have any chance of affecting the normal situation
                // 99.9% of users will be in).
                if ((new Date()).getTime() > rpc.speculativeWebSocketAttemptProhibitedUntil.getTime())
                {
                    log.debug("Speculatively trying to open a webSocket connection");
                    rpc.speculativeWebSocketAttemptProhibitedUntil = new Date();
                    rpc.speculativeWebSocketAttemptProhibitedUntil.setTime(
                        rpc.speculativeWebSocketAttemptProhibitedUntil.getTime() + 73000);
                    rpc.httpConnectionAttemptCallback();
                } else
                {
                    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                                              .getService(Components.interfaces.nsIIOService);
                    var uri = ioService.newURI(rpc.httpChannelURI, null, null);

                    // get a channel for that nsIURI
                    rpc.httpChannel = Services.io.newChannelFromURI(
                        uri,
                        null, // loadingNode
                        Services.scriptSecurityManager.getSystemPrincipal(), // loadingPrincipal
                        null, // triggeringPrincipal
                        Ci.nsILoadInfo.SEC_ALLOW_CROSS_ORIGIN_DATA_IS_NULL, // securityFlags
                        Ci.nsIContentPolicy.TYPE_OTHER // contentPolicyType
                    );

                    var listener = new KPRPCHTTPStreamListener(rpc.httpConnectionAttemptCallback);
                    rpc.httpChannel.notificationCallbacks = listener;

                    // Try to connect
                    // There may be more than one concurrent attempted connection.
                    // If more than one attempted connection returns the correct status code,
                    // we will see a batch of "alive" or "locked" states for subsequent callbacks
                    // That should be fine but we could implement a more complex request ID
                    // tracking system in future if it becomes a problem
                    rpc.httpChannel.asyncOpen(listener, null);
                }
           }
    };
}).apply(session.prototype);


function KPRPCHTTPStreamListener(aCallbackFunc) {
  this.mCallbackFunc = aCallbackFunc;
}

KPRPCHTTPStreamListener.prototype = {

  // nsIStreamListener
  onStartRequest: function (aRequest, aContext) {
    // aRequest.status = 2152398868 = successful connect to KPRPC
    // aRequest.status = 0 = deadlocked connection to ourselves

    // If we're successful, make sure the connection is cancelled.
    // This is our only hope of preventing simultaneous TCP connect
    // bugs using the FF interfaces. We may be able to get away with testing for just status === 0?
    if (aRequest.status !== 2152398861)
    {
        log.info("HTTP connection not refused. We will now cancel the connection, maintaining the existing status code.");
        aRequest.cancel(aRequest.status);
    }
   },

  // don't expect to receive any data but just in case, we want to handle it properly
  onDataAvailable: function (...args) {
    let /*aRequest,*/ aStream, /*aSourceOffset,*/ aLength;
    log.debug("HTTP data available.");
    var scriptableInputStream = 
      Components.classes["@mozilla.org/scriptableinputstream;1"]
        .createInstance(Components.interfaces.nsIScriptableInputStream);
    let hasArgument = false;
    // The old API passes the stream as third parameter.
    if (args[2] instanceof Ci.nsIInputStream){
        aStream = args[2];
        aLength = args[4];
        hasArgument = true;
    }
    // The new API uses the second parameter.
    if (args[1] instanceof Ci.nsIInputStream){
        aStream = args[1];
        aLength = args[3];
        hasArgument = true;
    }
    if (hasArgument) {
        scriptableInputStream.init(aStream);
        scriptableInputStream.read(aLength);
        return;
    }

    throw new Error("Unknown signature for nsIStreamListener.onDataAvailable()");
  },
  
  onStopRequest: function (aRequest, aContext, aStatus) {
    // Unless connection has been refused, we want to try connecting with the websocket protocol
    if (aStatus !== 2152398861)
    {
        log.info("HTTP connection not refused. We will now attempt a web socket connection.");
        this.mCallbackFunc();
    }
    else
    {
        log.debug("HTTP connection refused. Will not attempt web socket connection.");
    }
  },

  // nsIInterfaceRequestor
  getInterface: function (aIID) {
    try {
      return this.QueryInterface(aIID);
    } catch (e) {
      throw Components.results.NS_NOINTERFACE;
    }
  },

  // nsIChannelEventSink (not implementing - no need)
  onChannelRedirect: function (aOldChannel, aNewChannel, aFlags) { },

  // nsIProgressEventSink (not implementing will cause annoying exceptions)
  onProgress : function (aRequest, aContext, aProgress, aProgressMax) { },
  onStatus : function (aRequest, aContext, aStatus, aStatusArg) { },

  // nsIHttpEventSink (not implementing will cause annoying exceptions)
  onRedirect : function (aOldChannel, aNewChannel) { },

  // we are faking an XPCOM interface, so we need to implement QI
  QueryInterface : function(aIID) {
    if (aIID.equals(Components.interfaces.nsISupports) ||
        aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
        aIID.equals(Components.interfaces.nsIChannelEventSink) || 
        aIID.equals(Components.interfaces.nsIProgressEventSink) ||
        aIID.equals(Components.interfaces.nsIHttpEventSink) ||
        aIID.equals(Components.interfaces.nsIStreamListener))
      return this;

    throw Components.results.NS_NOINTERFACE;
  }
};
