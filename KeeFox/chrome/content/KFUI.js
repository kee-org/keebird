/*
  KeeFox - Allows Firefox to communicate with KeePass (via the KeeICE KeePass-plugin)
  Copyright 2008 Chris Tomlinson <keefox@christomlinson.name>
  
  This is the KeeFox Improved Login Manager javascript file. The KFILM object
  is mainly concerned with user-visible behaviour and actual use of the data
  in the active KeePass database. Eventually this should have enough options
  and features to allow the user fine control over their password management
  experience.
  
  Some of the code is based on Mozilla's LoginManagerPrompt.js, used under
  GPL 2.0 terms. Lots of the functions are currently unused and really just
  there in case they prove useful in the future.

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

/* ==================== LoginManagerPrompter ==================== */

/*
 * LoginManagerPrompter
 *
 * Implements interfaces for prompting the user to enter/save/change auth info.
 *
 * nsIAuthPrompt: Used by SeaMonkey, Thunderbird, but not Firefox.
 *
 * nsIAuthPrompt2: Is invoked by a channel for protocol-based authentication
 * (eg HTTP Authenticate, FTP login).
 *
 * nsILoginManagerPrompter: Used by Login Manager for saving/changing logins
 * found in HTML forms.
 */
function KFUI() {

}

KFUI.prototype = {

    _window        : null,
    setWindow : function (win)
    {
        this._window = window;
    },
    _document : null,
    setDocument : function (doc)
    {
        this._document = doc;
    },
    
    _debug         : false, // mirrors signon.debug (eventually)

    _kf : null,
    _kfilm : null,
        
    __logService : null, // Console logging service, used for debugging.
    get _logService() {
        if (!this.__logService)
            this.__logService = Cc["@mozilla.org/consoleservice;1"].
                                getService(Ci.nsIConsoleService);
        return this.__logService;
    },

    __promptService : null, // Prompt service for user interaction
    get _promptService() {
        if (!this.__promptService)
            this.__promptService =
                Cc["@mozilla.org/embedcomp/prompt-service;1"].
                getService(Ci.nsIPromptService2);
        return this.__promptService;
    },


    __strBundle : null, // String bundle for L10N
    get _strBundle() {
        if (!this.__strBundle) {
            var bunService = Cc["@mozilla.org/intl/stringbundle;1"].
                             getService(Ci.nsIStringBundleService);
            this.__strBundle = bunService.createBundle(
                        "chrome://passwordmgr/locale/passwordmgr.properties");
            if (!this.__strBundle)
                throw "String bundle for Login Manager not present!";
        }

        return this.__strBundle;
    },


    __brandBundle : null, // String bundle for L10N
    get _brandBundle() {
        if (!this.__brandBundle) {
            var bunService = Cc["@mozilla.org/intl/stringbundle;1"].
                             getService(Ci.nsIStringBundleService);
            this.__brandBundle = bunService.createBundle(
                        "chrome://branding/locale/brand.properties");
            if (!this.__brandBundle)
                throw "Branding string bundle not present!";
        }

        return this.__brandBundle;
    },


    __ioService: null, // IO service for string -> nsIURI conversion
    get _ioService() {
        if (!this.__ioService)
            this.__ioService = Cc["@mozilla.org/network/io-service;1"].
                               getService(Ci.nsIIOService);
        return this.__ioService;
    },


    // Internal function for logging debug messages to the Error Console window
    log : function (message) {
        this._kf.log(message+"\n");
        //if (this._kf._keeFoxExtension.prefs.getValue("debugToConsole",false))
        //    this._logService.logStringMessage(message);

    },


    /* ---------- nsILoginManagerPrompter prompts ---------- */




    /*
     * init
     *
     */
    //init : function (aWindow,kf,kfilm) {
    init : function (kf,kfilm) {
        
        this._kf = kf;
        this._kfilm = kfilm;
        this._window = this._kfilm._currentWindow;

        //var prefBranch = Cc["@mozilla.org/preferences-service;1"].
        //                 getService(Ci.nsIPrefService).getBranch("signon.");
        //this._debug = prefBranch.getBoolPref("debug");
        this.log("===== initialized =====");
    },


    /*
     * promptToSavePassword
     *
     */
    promptToSavePassword : function (aLogin, isMultiPage) {
        var notifyBox = this._getNotifyBox();

        if (notifyBox)
            this._showSaveLoginNotification(notifyBox, aLogin, isMultiPage);
        else
            this._showSaveLoginDialog(aLogin);
    },


    /*
     * _showLoginNotification
     *
     * Displays a notification bar.
     *
     */
    _showLoginNotification : function (aNotifyBox, aName, aText, aButtons) {
        var oldBar = aNotifyBox.getNotificationWithValue(aName);
        const priority = aNotifyBox.PRIORITY_INFO_MEDIUM;

        this.log("Adding new " + aName + " notification bar");
        var newBar = aNotifyBox.appendNotification(
                                aText, aName,
                                "chrome://mozapps/skin/passwordmgr/key.png",
                                priority, aButtons);

        // The page we're going to hasn't loaded yet, so we want to persist
        // across the first location change.
        newBar.persistence++;

        // Sites like Gmail perform a funky redirect dance before you end up
        // at the post-authentication page. I don't see a good way to
        // heuristically determine when to ignore such location changes, so
        // we'll try ignoring location changes based on a time interval.
        newBar.timeout = Date.now() + 20000; // 20 seconds

        if (oldBar) {
            this.log("(...and removing old " + aName + " notification bar)");
            aNotifyBox.removeNotification(oldBar);
        }
        return newBar;
    },


    /*
     * _showSaveLoginNotification
     *
     * Displays a notification bar (rather than a popup), to allow the user to
     * save the specified login. This allows the user to see the results of
     * their login, and only save a login which they know worked.
     *
     */
    _showSaveLoginNotification : function (aNotifyBox, aLogin, isMultiPage) {

        //var DBname = null;//_kf.getDatabaseName();
        var notificationText = "";

        
      /*  // Find the <browser> which contains notifyWindow, by looking
            // through all the open windows and all the <browsers> in each.
            var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
                     getService(Ci.nsIWindowMediator);
            var enumerator = wm.getEnumerator("navigator:browser");
            var tabbrowser = null;
            var foundBrowser = null;
//this.log("window has name:" + notifyWindow.name);
            while (!foundBrowser && enumerator.hasMoreElements()) {
                var win = enumerator.getNext();
                this.log("found window with name:" + win.name);
                tabbrowser = win.getBrowser(); 
                foundBrowser = tabbrowser.getBrowserForDocument(
                                                  this._document);
            }
            
            // this is null... why is this so fucking shit?!
            var document = foundBrowser.document;
            */
            
            
        // Ugh. We can't use the strings from the popup window, because they
        // have the access key marked in the string (eg "Mo&zilla"), along
        // with some weird rules for handling access keys that do not occur
        // in the string, for L10N. See commonDialog.js's setLabelForNode().
        var neverButtonText =
              this._getLocalizedString("notifyBarNeverForSiteButton.label");
        var neverButtonAccessKey =
              this._getLocalizedString("notifyBarNeverForSiteButton.key");
        var rememberButtonText =
              this._getLocalizedString("notifyBarRememberButton.label");
        var rememberButtonAccessKey =
              this._getLocalizedString("notifyBarRememberButton.key");
        var rememberAdvancedButtonText =
              this._getLocalizedString("notifyBarRememberAdvancedButton.label");
        var rememberAdvancedButtonAccessKey =
              this._getLocalizedString("notifyBarRememberAdvancedButton.key");
        var notNowButtonText =
              this._getLocalizedString("notifyBarNotNowButton.label");
        var notNowButtonAccessKey =
              this._getLocalizedString("notifyBarNotNowButton.key");

        /*if (DBname != undefined && DBname != null) 
            notificationText = this._getLocalizedString(
                                        "savePasswordText", [DBname]);
        else
            notificationText = this._getLocalizedString(
                                        "savePasswordText", ["un-named"]);
        */
                                        
       

        // The callbacks in |buttons| have a closure to access the variables
        // in scope here; set one to |this._pwmgr| so we can get back to pwmgr
        // without a getService() call.
        var kfilm = this._kfilm;

        var popupName = "rememberAdvancedButtonPopup";
        if (isMultiPage)
        {
        
        popupName = "rememberAdvancedButtonPopup2";
        notificationText = this._getLocalizedString("saveMultiPagePasswordText");
        
        } else
        {
        notificationText = this._getLocalizedString("savePasswordText");
        }

        var buttons = [
            // "Remember" button
            {
                label:     rememberButtonText,
                accessKey: rememberButtonAccessKey,
                popup:     null,
                callback: function(aNotificationBar, aButton) {
                    var result = kfilm.addLogin(aLogin, null);
                    if (result == "This login already exists.") //TOD: verify this doesn't crash when actual result found or is null
                    {
                        //TODO: create a new notification bar for 2 seconds with an error message?
                    }
                    //TODO: copy completed to multi-page menu, etc.
                
                    keeFoxToolbar.clearTabFormRecordingData();
                    //aNotificationBar.parentNode.removeCurrentNotification();
                }
            },
            
            {
                label:     rememberAdvancedButtonText,
                accessKey: rememberAdvancedButtonAccessKey,
                popup:     popupName,
                callback: null
            },

            // "Never for this site" button
            /*{
                label:     neverButtonText,
                accessKey: neverButtonAccessKey,
                popup:     null,
                callback: function(aNotificationBar, aButton) {
                    kfilm.setLoginSavingEnabled(aLogin.hostname, false);
                }
            },*/

            // "Not now" button
            {
                label:     notNowButtonText,
                accessKey: notNowButtonAccessKey,
                popup:     null,
                callback:  function() { 
                    keeFoxToolbar.clearTabFormRecordingData();
                } 
            }
        ];
        
         this._showLoginNotification(aNotifyBox, "password-save",
             notificationText, buttons);
        
/*        var notification = notificationBox.appendNotification(
"this is the notification text",
"notificationID",
"notification.png",
notificationBox.PRIORITY_WARNING_LOW,
null);
*/
/*

//var customString = "

       // this._showLoginNotification(aNotifyBox, "password-save",
       //      notificationText, buttons);
             
             var oldBar = aNotifyBox.getNotificationWithValue("password-save");
        const priority = aNotifyBox.PRIORITY_INFO_MEDIUM;

        this.log("Adding new password-save notification bar");
        var newBar = aNotifyBox.appendNotification(
                                "test original text", "password-save",
                                "chrome://mozapps/skin/passwordmgr/key.png",
                                priority, null);
                                //priority, buttons);
                                
         this.log("hh:"+newBar.value);                       
         this.log("hfh:"+newBar.messageText);
var messageText = document.getAnonymousElementByAttribute(newBar, "anonid", "messageText");
messageText.setAttribute("flex", "1000");
//messageText.setAttribute("style", "width: 90%;");

var fragment = document.createDocumentFragment();
fragment.appendChild(document.createTextNode("new "));
var italic = document.createElementNS("http://www.w3.org/1999/xhtml", "i");
italic.appendChild(document.createTextNode("replacement"));
fragment.appendChild(italic);
fragment.appendChild(document.createTextNode(" text element."));

messageText.removeChild(messageText.firstChild);
messageText.appendChild(fragment);

//var detailsHolder = document.getAnonymousElementByAttribute(newBar, "anonid", "details");

  const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  var item = document.createElementNS(XUL_NS, "button"); // create a new XUL menuitem
  item.setAttribute("label", "press me");
  item.setAttribute("oncommand", "alert('press me');");
  
  var spacer = document.createElementNS(XUL_NS, "spacer"); // create a new XUL menuitem
  spacer.setAttribute("flex", "1000");
spacer.setAttribute("style", "width: 90%;");
var fragment_again = document.createDocumentFragment();
fragment_again.appendChild(spacer);
fragment_again.appendChild(item);
var italic_again = document.createElementNS("http://www.w3.org/1999/xhtml", "i");
italic_again.appendChild(document.createTextNode("tempDDD"));
fragment_again.appendChild(italic_again);
//fragment.appendChild(document.createTextNode(" text element."));

//var popup = document.getElementById("myPopup"); // a <menupopup> element
//var first = createMenuItem("First item");
//var last = createMenuItem("Last item");
//popup.insertBefore(first, popup.firstChild);
//detailsHolder.appendChild(item);
//messageText.parentNode.insertBefore(document.createTextNode("TESTTTT!"), messageText.nextSibling.nextSibling);
messageText.appendChild(fragment_again);
//messageText.parentNode.appendChild(document.createTextNode("TEST2!"));
//detailsHolder.appendChild(document.createTextNode("TEST3!"));


// use this to get the order right?
//parentDiv.insertBefore(sp1, sp2.nextSibling);


    
             var notification = notificationBox.appendNotification(
"this is the notification text",
"notificationID",
"notification.png",
notificationBox.PRIORITY_WARNING_LOW,
null);

var messageText = document.getAnonymousElementByAttribute(notification, "anonid", "messageText");

var fragment = document.createDocumentFragment();
fragment.appendChild(document.createTextNode("new "));
var italic = document.createElementNS("http://www.w3.org/1999/xhtml", "i");
italic.appendChild(document.createTextNode("replacement"));
fragment.appendChild(italic);
fragment.appendChild(document.createTextNode(" text element."));

messageText.removeChild(messageText.firstChild);
messageText.appendChild(fragment);

(http://forums.mozillazine.org/viewtopic.php?f=19&t=525703)
*/


    },


    /*
     * _removeSaveLoginNotification
     *
     */
    _removeSaveLoginNotification : function (aNotifyBox) {

        var oldBar = aNotifyBox.getNotificationWithValue("password-save");

        if (oldBar) {
            this.log("Removing save-password notification bar.");
            aNotifyBox.removeNotification(oldBar);
        }
    },

    /*
     * promptToChangePassword
     *
     * Called when we think we detect a password change for an existing
     * login, when the form being submitted contains multiple password
     * fields.
     *
     */
    promptToChangePassword : function (aOldLogin, aNewLogin) {
        var notifyBox = this._getNotifyBox();

        if (notifyBox)
            this._showChangeLoginNotification(notifyBox, aOldLogin, aNewLogin);
    },


    /*
     * _showChangeLoginNotification
     *
     * Shows the Change Password notification bar.
     *
     */
    _showChangeLoginNotification : function (aNotifyBox, aOldLogin, aNewLogin) {
        var notificationText;
        var oldUsernameValue = "";
        
        if (aOldLogin.usernameIndex >= 0 && aOldLogin.otherFields != null && aOldLogin.otherFields.length > 0)
        {
            oldUsernameValue = aOldLogin.otherFields[aOldLogin.usernameIndex].value;
        }
        
        if (oldUsernameValue.length > 0)
            notificationText  = this._getLocalizedString(
                                          "passwordChangeText",
                                          [oldUsernameValue]);
        else
            notificationText  = this._getLocalizedString(
                                          "passwordChangeTextNoUser");

        var changeButtonText =
              this._getLocalizedString("notifyBarChangeButton.label");
        var changeButtonAccessKey =
              this._getLocalizedString("notifyBarChangeButton.key");
        var dontChangeButtonText =
              this._getLocalizedString("notifyBarDontChangeButton.label");
        var dontChangeButtonAccessKey =
              this._getLocalizedString("notifyBarDontChangeButton.key");

        // The callbacks in |buttons| have a closure to access the variables
        // in scope here; set one to |this._pwmgr| so we can get back to pwmgr
        // without a getService() call.
        var kfilm = this._kfilm;

        var buttons = [
            // "Yes" button
            {
                label:     changeButtonText,
                accessKey: changeButtonAccessKey,
                popup:     null,
                callback:  function(aNotificationBar, aButton) {
                    kfilm.modifyLogin(aOldLogin, aNewLogin);
                }
            },

            // "No" button
            {
                label:     dontChangeButtonText,
                accessKey: dontChangeButtonAccessKey,
                popup:     null,
                callback:  function(aNotificationBar, aButton) {
                    // do nothing
                }
            }
        ];

        this._showLoginNotification(aNotifyBox, "password-change",
             notificationText, buttons);
    },

    _showLaunchKFNotification : function () {

        var notifyBox = this._getNotifyBox();

        var loginButtonText =
              this._getLocalizedString("notifyBarLaunchKeePassButton.label");
        var loginButtonAccessKey =
              this._getLocalizedString("notifyBarLaunchKeePassButton.key");
        var notNowButtonText =
              this._getLocalizedString("notifyBarNotNowButton.label");
        var notNowButtonAccessKey =
              this._getLocalizedString("notifyBarNotNowButton.key");

        var notificationText  = 
            this._getLocalizedString("notifyBarLaunchKeePass.label");
        

        var kfilm = this._kfilm;
        var kf = this._kf;


        var buttons = [
            // "Remember" button
            {
                label:     loginButtonText,
                accessKey: loginButtonAccessKey,
                popup:     null,
                callback: function(aNotificationBar, aButton) {
                    kf.launchKeePass('');
                }
            },

            // "Not now" button
            {
                label:     notNowButtonText,
                accessKey: notNowButtonAccessKey,
                popup:     null,
                callback:  function() { /* NOP */ } 
            }
        ];

        this._showLoginNotification(notifyBox, "keefox-launch",
             notificationText, buttons);
    },
    
    _showLoginToKFNotification : function () {

        var notifyBox = this._getNotifyBox();

        var loginButtonText =
              this._getLocalizedString("notifyBarLoginToKeePassButton.label");
        var loginButtonAccessKey =
              this._getLocalizedString("notifyBarLoginToKeePassButton.key");
        var notNowButtonText =
              this._getLocalizedString("notifyBarNotNowButton.label");
        var notNowButtonAccessKey =
              this._getLocalizedString("notifyBarNotNowButton.key");

        var notificationText  = 
            this._getLocalizedString("notifyBarLoginToKeePass.label");

        var kfilm = this._kfilm;
        var kf = this._kf;


        var buttons = [
            // "Remember" button
            {
                label:     loginButtonText,
                accessKey: loginButtonAccessKey,
                popup:     null,
                callback: function(aNotificationBar, aButton) {
                    kf.loginToKeePass();
                }
            },

            // "Not now" button
            {
                label:     notNowButtonText,
                accessKey: notNowButtonAccessKey,
                popup:     null,
                callback:  function() { /* NOP */ } 
            }
        ];

        this._showLoginNotification(notifyBox, "keefox-login",
             notificationText, buttons);
    },
    
    /*
     * _removeOLDKFNotifications
     *
     */
    _removeOLDKFNotifications : function () {

        var notifyBox = this._getNotifyBox();
        
        if (notifyBox)
        {
            var oldBar = notifyBox.getNotificationWithValue("password-save");

            if (oldBar) {
                this.log("Removing save-password notification bar.");
                notifyBox.removeNotification(oldBar);
            }
            
            oldBar = notifyBox.getNotificationWithValue("keefox-login");

            if (oldBar) {
                this.log("Removing keefox-login notification bar.");
                notifyBox.removeNotification(oldBar);
            }
            
            oldBar = notifyBox.getNotificationWithValue("keefox-launch");

            if (oldBar) {
                this.log("Removing keefox-launch notification bar.");
                notifyBox.removeNotification(oldBar);
            }
        }
    },
    
    
    






    /* ---------- Internal Methods ---------- */




    /*
     * _getNotifyBox
     *
     * Returns the notification box to this prompter, or null if there isn't
     * a notification box available.
     */
    _getNotifyBox : function () {
        try {
            // Get topmost window, in case we're in a frame.
            var notifyWindow = this._window.top
            //notifyWindow.alert("hello");

            // Some sites pop up a temporary login window, when disappears
            // upon submission of credentials. We want to put the notification
            // bar in the opener window if this seems to be happening.
            if (notifyWindow.opener) {
                var webnav = notifyWindow
                                    .QueryInterface(Ci.nsIInterfaceRequestor)
                                    .getInterface(Ci.nsIWebNavigation);
                var chromeWin = webnav
                                    .QueryInterface(Ci.nsIDocShellTreeItem)
                                    .rootTreeItem
                                    .QueryInterface(Ci.nsIInterfaceRequestor)
                                    .getInterface(Ci.nsIDOMWindow);
                var chromeDoc = chromeWin.document.documentElement;

                // Check to see if the current window was opened with chrome
                // disabled, and if so use the opener window. But if the window
                // has been used to visit other pages (ie, has a history),
                // assume it'll stick around and *don't* use the opener.
                if (chromeDoc.getAttribute("chromehidden") &&
                    webnav.sessionHistory.count == 1) {
                    this.log("Using opener window for notification bar.");
                    notifyWindow = notifyWindow.opener; //not convinced this will work - maybe change this._document
                }
            }


            // Find the <browser> which contains notifyWindow, by looking
            // through all the open windows and all the <browsers> in each.
            var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
                     getService(Ci.nsIWindowMediator);
            var enumerator = wm.getEnumerator("navigator:browser");
            var tabbrowser = null;
            var foundBrowser = null;
//this.log("window has name:" + notifyWindow.name);
            while (!foundBrowser && enumerator.hasMoreElements()) {
                var win = enumerator.getNext();
                this.log("found window with name:" + win.name);
                tabbrowser = win.getBrowser(); 
                foundBrowser = tabbrowser.getBrowserForDocument(
                                                  this._document);
            }

            // Return the notificationBox associated with the browser.
            if (foundBrowser)
            {
                this.log("found a browser for this window.");
                return tabbrowser.getNotificationBox(foundBrowser)
            }

        } catch (e) {
            // If any errors happen, just assume no notification box.
            this.log("No notification box available: " + e)
        }

        return null;
    },


    /*
     * _getLocalizedString
     *
     * Can be called as:
     *   _getLocalizedString("key1");
     *   _getLocalizedString("key2", ["arg1"]);
     *   _getLocalizedString("key3", ["arg1", "arg2"]);
     *   (etc)
     *
     * Returns the localized string for the specified key,
     * formatted if required.
     *
     */ 
    _getLocalizedString : function (key, formatArgs) {
        if (formatArgs)
            return this._kf.strbundle.getFormattedString(key, formatArgs);
        else
            return this._kf.strbundle.getString(key);
    },


    /*
     * _getFormattedHostname
     *
     * The aURI parameter may either be a string uri, or an nsIURI instance.
     *
     * Returns the hostname to use in a nsILoginInfo object (for example,
     * "http://example.com").
     */
    _getFormattedHostname : function (aURI) {
        var uri;
        if (aURI instanceof Ci.nsIURI) {
            uri = aURI;
        } else {
            uri = this._ioService.newURI(aURI, null, null);
        }
        var scheme = uri.scheme;

        var hostname = scheme + "://" + uri.host;

        // If the URI explicitly specified a port, only include it when
        // it's not the default. (We never want "http://foo.com:80")
        port = uri.port;
        if (port != -1) {
            var handler = this._ioService.getProtocolHandler(scheme);
            if (port != handler.defaultPort)
                hostname += ":" + port;
        }

        return hostname;
    },


 setTreeViewGroupChooser : function()
 {

// TODO: Check to see if we are logged in and trigger an attempt to if not (fail or create dummy chooser if can't log in?)

// Get array of group names (and guids somehow) which are ordered by depth-first queries to the group folder structure from KeeICE.

keefoxInst.treeViewGroupChooser = {
    rowCount : 10000,
    getCellText : function(row,column){
      if (column.id == "namecol") return "Row "+row;
      else return "February 18";
    },
    setTree: function(treebox){ this.treebox = treebox; },
    isContainer: function(row){ return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(index, properties) {
    
  var atomService = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
  var atom = atomService.getAtom("dummy"); //TODO: maybe set this to be the GUID of the appropriate group?
  properties.AppendElement(atom);
},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){}
};

    document.getElementById('keefox-group-chooser-tree').view = keefoxInst.treeViewGroupChooser;
}


};

var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
                       .getService(Components.interfaces.mozIJSSubScriptLoader); 
loader.loadSubScript("resource://kfscripts/KFUI_protocol.js");   
