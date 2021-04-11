// Import any needed modules.
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://keefox/content/keefoxWin.js", window, "UTF-8");

// mimic the overlay from chrome.manifest
// overlay chrome://messenger/content/messenger.xul chrome://keefox/content/panel.xul
function onLoad(activatedWhileWindowOpen) {
  // Inject a XUL fragment (providing the needed DTD files as well)
  // using the injectElements helper function. The added elements
  // will be automatically removed on window unload.
  //insertafter
  WL.injectElements(`
<overlay id="KeeFox-Overlay" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
  <popupset>
    <menupopup id="KeeFox-login-context" position="after_start">
    </menupopup>
    <menupopup id="KeeFox-group-context" position="after_start">
    </menupopup>
  </popupset>
</overlay>`);
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return
  }
}