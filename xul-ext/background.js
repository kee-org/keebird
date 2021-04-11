/**
 * commented out locales are not complete enough on Transifex
 */
const locales = [
    'cs', 
    //'da', 
    'de', 
    //'el', 
    'en-US', 
    'es-AR', 
    'fi', 
    'fr', 
    //'hi',
    'hu',
    //'it', 
    //'ja', 
    //'ko-KR', 
    'nl', 
    //'pl', 
    //'pt-BR', 
    //'pt-PT', 
    //'ro', 
    'ru', 
    'sl', 
    //'sv-SE', 
    'tr', 
    'ul', 
    'zh-CN'
];
(async () => {
    // https://github.com/thundernest/addon-developer-support/wiki/WindowListener-API:-Getting-Started#windowlistenerregisterdefaultprefs
    messenger.WindowListener.registerDefaultPrefs("defaults/preferences/prefs.js")
    /**
     * https://github.com/thundernest/addon-developer-support/wiki/WindowListener-API:-Getting-Started#windowlistenerregisterchromeurl
     * Register the content, resource and locale entries from your legacy chrome.manifest via a call to registerChromeUrl().
     */
    messenger.WindowListener.registerChromeUrl([ 
        ["content",  "keefox",                  "chrome/content/"],
        ["resource", "keefox", /*"classic/1.0", */  "chrome/skin/"],
        ["resource", "kfmod",                   "modules/"],
        ...locales.map((localeId) => 
        ["locale",   "keefox", localeId,        `chrome/locale/${localeId}/`])
    ]);
    //xul-ext/chrome/skin
    // https://github.com/thundernest/addon-developer-support/wiki/WindowListener-API:-Getting-Started#windowlistenerregisteroptionspage
    messenger.WindowListener.registerOptionsPage("chrome://keefox/content/options.xhtml");

    //
    messenger.WindowListener.registerWindow(
        "chrome://messenger/content/messenger.xhtml", 
        "chrome://keefox/content/scripts/messengerPanel.js");

    messenger.WindowListener.registerWindow(
        "chrome://global/content/commonDialog.xhtml", 
        "chrome://keefox/content/scripts/KFcommonDialog.js");
    /*
        messenger.WindowListener.registerWindow(
            "chrome://global/content/win.xul",
            "chrome://keefox/content/scripts/install.js");*/

    await messenger.WindowListener.startListening();
})()