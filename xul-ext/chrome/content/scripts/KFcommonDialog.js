// Import any needed modules.
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://keefox/content/KFcommonDialog.js", window, "UTF-8");
//Services.scriptloader.loadSubScript("chrome://keefox/content/scripts/testPath.js", window, "UTF-8");

// mimic 
// overlay	chrome://global/content/commonDialog.xul chrome://keefox/content/protocolAuth.xul
function onLoad(activatedWhileWindowOpen) {

  WL.injectElements(`
<overlay id="KeeFox-Common-Dialog-Overlay"
  xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
  <window windowtype="navigator:browser"></window>
</overlay>`);

    window.keeFoxDialogManager.dialogInit();
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return
  }
}