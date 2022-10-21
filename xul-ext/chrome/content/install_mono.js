/*
KeeFox - Allows Firefox to communicate with KeePass (via the KeePassRPC KeePass-plugin)
Copyright 2008-2015 Chris Tomlinson <keefox@christomlinson.name>
  
This install_mono.js file helps manage the installation under Mono.

See install_mono.xhtml for a description of each of the ICs (Install Cases)

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

// whether we're upgrading from a previous version
var KFupgradeMode = false;

var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
.getInterface(Components.interfaces.nsIWebNavigation)
.QueryInterface(Components.interfaces.nsIDocShellTreeItem)
.rootTreeItem
.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
.getInterface(Components.interfaces.nsIDOMWindow);

function prepareMonoInstallPage() {
    var qs = "";
    var args = new Object();
    var query = location.search.substring(1);
    var pairs = query.split("&");
    for (var i = 0; i < pairs.length; i++) {
        var pos = pairs[i].indexOf('=');
        if (pos == -1) continue;
        var argname = pairs[i].substring(0, pos);
        var value = pairs[i].substring(pos + 1);
        args[argname] = unescape(value);
    }
    let downgradeWarning = "desc_Install_monoManualDowngradeWarning";
    if (args.upgrade == "1") {
        KFupgradeMode = true;
        mainWindow.keefox_org._KFLog.debug("Install system starting in upgrade mode");
        document.getElementById('Install_monoManualUpgrade').setAttribute('hidden', false);
        if (args.downWarning == "1" && args.currentKPRPCv && args.newKPRPCv) {
            document.getElementById('desc_Install_monoManualDowngradeWarning').setAttribute('hidden', false);
            downgradeWarning = ['desc_Install_monoManualDowngradeWarning', [args.newKPRPCv, args.currentKPRPCv]];
        }
        document.getElementById('Install_monoManual').setAttribute('hidden', true);
    }
    else {
        mainWindow.keefox_org._KFLog.debug("Install system starting in install mode");
    }
    mainWindow.keefox_org.locale.internationaliseElements(document,
          ['KeeFoxInstallWizard', 'KFInstallPageTitle_description', 'desc_KFInstallAlreadyInProgress', 'desc_KFInstallNotRequired', 'lab_KFInstallNotRequired',
          'desk_Install_monoManual', 'monoManualStep1_description', 'monoManualStep2_description', 'monoManualStep3_description', 'monoManualStep4_description', 'monoManualStep5_description',
           'monoManualStep6_description', 'desc_Install_monoManual', downgradeWarning, 'desc_Install_monoManualUpgrade', 'monoManualUpgradeStep1_description', 'monoManualUpgradeStep2_description', 'monoManualUpgradeStep6_description',
           'desc_Install_monoManual2', 'monoManualTest1a_description', 'monoManualTest2a_description', 'monoManualTest1_description', 'monoManualTest2_description', 'monoManualTest3_description'
          ],
          ['title', 'label', 'tooltiptext', 'accesskey', 'value']);


    // prevent reinstallation if KeeFox is already working
    if (mainWindow.keefox_org._keeFoxStorage.get("KeePassRPCActive", false)) {
        document.getElementById('KFInstallNotRequired').setAttribute('hidden', false);
        return;
    }

    /*
     * Show the user the path to the 'deps' folder of their keefox extension
     */
    var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties);
    var dir = directoryService.get("ProfD", Components.interfaces.nsIFile);
    dir.append("extensions");
    dir.append("keefox@chris.tomlinson");
    dir.append("deps");
    if (KFupgradeMode) {
        document.getElementById('monoManualUpgradeStep5a_link').textContent = dir.path;
        document.getElementById('monoManualUpgradeStep5a_link').setAttribute('href', 'file:///' + dir.path);
    } else {
        document.getElementById('monoManualStep5a_link').textContent = dir.path;
        document.getElementById('monoManualStep5a_link').setAttribute('href', 'file:///' + dir.path);
    }

    var directoryService = Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties);
    var dir = directoryService.get("Home", Components.interfaces.nsIFile);
    dir.append("KeePass");
    document.getElementById('monoManualTest1a_description').textContent = dir.path;

    document.getElementById('monoManualTest2a_description').textContent = mainWindow.keefox_org.defaultMonoExec;
}




