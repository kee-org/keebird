// Import any needed modules.
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// Load an additional JavaScript file.
Services.scriptloader.loadSubScript("chrome://keefox/content/install.js", window, "UTF-8");

// mimic 
// overlay	chrome://global/content/commonDialog.xul chrome://keefox/content/protocolAuth.xul
function onLoad(activatedWhileWindowOpen) {

  WL.injectElements(`
<window id="KeeFoxInstallWizard" 
windowtype="navigator:browser"
title="%-KeeFox_Install_Setup_KeeFox.label-%" 
xmlns:html="http://www.w3.org/1999/xhtml"
xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
<!-- installation cases:

IC1: administrator and .NET not installed
IC2: administrator, .NET installed and KeePass not installed
IC3: administrator, .NET installed and KeePass installed
IC4: non-administrator and .NET not installed
IC5: non-administrator, .NET installed and KeePass not installed
IC6: non-administrator, .NET installed and KeePass installed
IC7: administrator, upgrade of KeePassRPC required
IC8: non-administrator, upgrade of KeePassRPC required

TODO:2: In some cases (especially IC6/8), user may not have priveledges to write
to an existing KeePass directory. If this happens, we will catch the access 
denied exception and give the user two choices:
a) Get an administrator to install the KeePassRPC files in the plugins folder
b) Choose a new installation directory for a seperate install of KeICE (warn
that this may not work and could be confusing and/or against organistation's policy)


outline of default and optional installation processes for each of the main cases
=================================================================================

IC1:
default:    run .NET 4.0 installer;
quietly run KeePass installer;
copy the KeePassRPC.plgx file to the newly installed KP location.
manual options:
Download and install .NET from Microsoft; restart and return to this page OR
download KeePass setup or ZIP from keepass.info; restart firefox to get back
to this page so it can complete the last step OR manually copy KeePassRPC.plgx
file from extension folder to plugin folder.

IC2:
default:    quietly run KeePass installer;
copy the KeePassRPC.plgx file to the newly installed KP location.
secondary:  run KeePass installer;
copy the KeePassRPC.plgx file to the newly installed KP location.
tertiary:   install KeePass ZIP contents into selected folder; [may be auto-skipped
if KP found in there already]
copy the KeePassRPC.plgx file to the newly installed KP location.

IC3:
default:    copy the KeePassRPC.plgx file to the discovered KP location.

IC4:
currently treated the same as IC1 (though a few visual differences are apparent
to the user before the install process starts)

IC5:
default:    install KeePass ZIP contents into selected folder; [may be 
auto-skipped if KP found in there already]
copy the KeePassRPC.plgx file to the newly installed KP location.
secondary:  run KeePass installer;
copy the KeePassRPC.plgx file to the newly installed KP location.

IC6:
default:    copy the KeePassRPC.plgx file to the discovered KP location.

IC7 and 8: Currently same as IC3/6 but will display different text to user            
-->

<grid flex="1" style="overflow: auto;">

<!-- centre the installation window -->
<columns>
<column flex="1" />
<column width="600px" />
<column flex="1" />
</columns>

<rows>
<row>
<spacer flex="1"/>

<vbox id="KFInstallPageMain" width="600px"  >

<vbox id="KFInstallHeader">
<image src='chrome://keefox/skin/install/header.png' width='580' height='116'/>
</vbox>

<vbox id="KFInstallPageTitle" width="590px" >
<description id="KFInstallPageTitle_description">%-KeeFox_Install_Setup_KeeFox.label-%</description>
</vbox>

<vbox id="KFInstallPageContent" width="590px" >

<vbox id="KFInstallAlreadyInProgress" hidden="true">
<description id="desc_KFInstallAlreadyInProgress">%-KeeFox_Install_Process_Running_In_Other_Tab.label-%</description>
</vbox>

<vbox id="KFInstallNotRequired" hidden="true">
<description id="desc_KFInstallNotRequired">%-KeeFox_Install_Not_Required.label-%</description>
<label href="http://keefox.org/help" class="text-link" id="lab_KFInstallNotRequired">%-KeeFox_Install_Not_Required_Link.label-%</label>
</vbox>

<vbox id="netUpgradeRequired" hidden="true">
<description id="desc_netUpgradeRequired">%-KeeFox_Install_NET_Upgrade_Required.label-%</description>
<label href="https://www.microsoft.com/en-us/download/details.aspx?id=48130" class="text-link">.NET 4.6</label>
<description id="desc_netUpgradeRequired_XP" style="margin-top: 15px;">%-KeeFox_Install_NET_Upgrade_Required_XP.label-%</description>
<label href="https://download.microsoft.com/download/7/B/6/7B629E05-399A-4A92-B5BC-484C74B5124B/dotNetFx40_Client_setup.exe" class="text-link">.NET 4.0 (Windows XP)</label>
<description id="desc_netUpgradeRequired_KeePass" style="margin-top: 15px;">%-KeeFox_Install_NET_Upgrade_Required_KeePass.label-%</description>
<label href="https://sourceforge.net/projects/keepass/" class="text-link">KeePass</label>
</vbox>

<vbox id="ERRORInstallButtonMain" hidden="true">
<description id="desc_ERRORInstallButtonMain">%-KeeFox_Install_Unexpected_Error.label-%</description>
</vbox>
<vbox id="ERRORInstallDownloadFailed" hidden="true">
<description id="desc_ERRORInstallDownloadFailed">%-KeeFox_Install_Download_Failed.label-%</description>
</vbox>
<vbox id="ERRORInstallDownloadChecksumFailed" hidden="true">
<description id="desc_ERRORInstallDownloadChecksumFailed">%-KeeFox_Install_Download_Checksum_Failed.label-%</description>
</vbox>
<vbox id="ERRORInstallDownloadCanceled" hidden="true">
<description id="desc_ERRORInstallDownloadCanceled">%-KeeFox_Install_Download_Canceled.label-%</description>
</vbox>

<vbox id="restartInstallationOption" hidden="true">
<button id="but_restartInstallationOption" label="%-KeeFox_Install_Try_Again_Button.label-%"
oncommand="resetInstallation(); window.location.reload(true);"/>
</vbox>


<!-- everything in this box is displayed on first page load and hidden
after installation has started -->
<vbox style="width:600px;" id="installationStartView" hidden="false">

<!-- these boxes can be styled to be big massive pretty "click me!" buttons -->

<vbox id="installationFoundWarning" hidden="true">
<description id="desc_installationFoundWarning" class="warning">%-KeeFox_Install_Already_Installed_Warning.description-%</description>
</vbox>

<!-- IC1, IC4 -->
<vbox id="setupExeInstallButtonMain" hidden="true">
<button id="but_setupExeInstallButtonMain" label="%-KeeFox_Install_Setup_KeeFox.label-%"
oncommand="setupExeInstall();"/>
</vbox>

<!-- IC2 -->
<vbox id="KPsetupExeSilentInstallButtonMain" hidden="true">
<button id="but_KPsetupExeSilentInstallButtonMain" label="%-KeeFox_Install_Setup_KeeFox.label-%"
oncommand="KPsetupExeSilentInstall();"/>
</vbox>

<!-- IC3, IC6 -->
<vbox id="copyKRPCToKnownKPLocationInstallButtonMain" hidden="true">
<button id="but_copyKRPCToKnownKPLocationInstallButtonMain" label="%-KeeFox_Install_Setup_KeeFox.label-%"
oncommand="copyKRPCToKnownKPLocationInstall();"/>
</vbox>

<!-- IC5 -->
<vbox id="copyKPToSpecificLocationInstallButtonMain" hidden="true">
<!-- file chooser field needed -->
<button id="but_copyKPToSpecificLocationInstallButtonMain" label="%-KeeFox_Install_copyKPToSpecificLocationInstallButton.label-%"
oncommand="copyKPToSpecificLocationInstall();"/>
</vbox>

<!-- IC7, IC8 -->
<vbox id="copyKRPCToKnownKPLocationUpgradeButtonMain" hidden="true">
<description class="warning" hidden="true" id="desc_Install_ManualDowngradeWarning">%-KeeFox_Install_Downgrade_Warning.label-%</description>
<description id="desc_copyKRPCToKnownKPLocationUpgradeButtonMain" class="warning">%-KeeFox_Install_PleaseCloseKeePass.description-%</description>
<button id="but_copyKRPCToKnownKPLocationUpgradeButtonMain" label="%-KeeFox_Install_Upgrade_KeeFox.label-%"
oncommand="copyKRPCToKnownKPLocationInstall();"/>
</vbox>


<!-- these boxes are used to provide a "click to see more options" interface to the user -->

<vbox id="setupNET35ExeInstallExpandee" hidden="true">
<description id="setupNET35ExeInstallExpandeeOverview">%-KeeFox_Install_setupNET35ExeInstallExpandeeOverview.description-%</description>
<description id="setupNET35ExeInstallExpandeeKeePass">%-KeeFox_Install_setupNET35ExeInstallExpandeeKeePass.description-%</description>
<!--<description id="setupNET35ExeInstallExpandeeNet">%-KeeFox_Install_setupNET35ExeInstallExpandeeNet.description-%</description>
<vbox id="setupNET35ExeInstallButton">
<button label="%-KeeFox_Install_setupNET35ExeInstallButton.label-%"
oncommand="setupNET35ExeInstall();"/>
</vbox>-->
<description id="setupNET35ExeInstallExpandeeManual">%-KeeFox_Install_setupNET35ExeInstallExpandeeManual.description-%</description>
<description id="setupNET35ExeInstallExpandeeManualStep1">%-KeeFox_Install_setupNET35ExeInstallExpandeeManualStep1.description-%</description>
<description id="setupNET35ExeInstallExpandeeManualStep2">%-KeeFox_Install_setupNET35ExeInstallExpandeeManualStep2.description-%</description>
<description id="setupNET35ExeInstallExpandeeManualStep3">%-KeeFox_Install_setupNET35ExeInstallExpandeeManualStep3.description-%</description>
<description id="setupNET35ExeInstallExpandeeManualStep4">%-KeeFox_Install_setupNET35ExeInstallExpandeeManualStep4.description-%</description>

</vbox>

<!-- IC2 -->
<vbox id="adminSetupKPInstallExpander" hidden="true">
<description id="desc_adminSetupKPInstallExpander">%-KeeFox_Install_adminSetupKPInstallExpander.description-%</description>
<button id="adminSetupKPInstallExpanderButton" 
label="%-KeeFox_Install_adminSetupKPInstallExpander_More_Info_Button.label-%"
oncommand="expandSection('adminSetupKPInstallExpandee',
'adminSetupKPInstallExpanderButton');"/>
</vbox>

<!-- IC3 -->
<vbox id="admincopyKRPCToKnownKPLocationInstallExpander" hidden="true">
<description id="desc_admincopyKRPCToKnownKPLocationInstallExpander">%-KeeFox_Install_admincopyKRPCToKnownKPLocationInstallExpander.description-%</description>
</vbox>

<!-- IC5 -->
<vbox id="nonAdminSetupKPInstallExpander" hidden="true">
<description id="desc_nonAdminSetupKPInstallExpander">%-KeeFox_Install_nonAdminSetupKPInstallExpander.description-%</description>
<!--<button id="nonAdminSetupKPInstallExpanderButton" 
label="%-KeeFox_Install_nonAdminSetupKPInstallExpander_More_Info_Button.label-%"
oncommand="expandSection('nonAdminSetupKPInstallExpandee',
'nonAdminSetupKPInstallExpanderButton');"/>-->
</vbox>

<!-- IC6 -->
<vbox id="nonAdmincopyKRPCToKnownKPLocationInstallExpander" hidden="true">
<description id="desc_nonAdmincopyKRPCToKnownKPLocationInstallExpander">%-KeeFox_Install_nonAdmincopyKRPCToKnownKPLocationInstallExpander.description-%</description>
<button id="nonAdmincopyKRPCToKnownKPLocationInstallExpanderButton" 
label="%-KeeFox_Install_nonAdmincopyKRPCToKnownKPLocationInstallExpander_More_Info_Button.label-%"
oncommand="expandSection('nonAdmincopyKRPCToKnownKPLocationInstallExpandee',
'nonAdmincopyKRPCToKnownKPLocationInstallExpanderButton');"/>
</vbox>

<!-- these boxes contain buttons and text that helps guide the user through
advanced install options -->

<vbox id="adminSetupKPInstallExpandee" hidden="true">
<description id="desc_adminSetupKPInstallExpandee">%-KeeFox_Install_adminSetupKPInstallExpandee.description-%</description>
<vbox id="KPsetupExeInstallButton" hidden="false">
<button id="but_KPsetupExeInstallButton" label="%-KeeFox_Install_KPsetupExeInstallButton.label-%"
oncommand="KPsetupExeInstall();"/>
</vbox>
<description id="desc_adminSetupKPInstallExpandee2">%-KeeFox_Install_adminSetupKPInstallExpandeePortable.description-%</description>
<vbox id="copyKPToSpecificLocationInstallButton" hidden="false">
<!-- file chooser field needed -->
<button id="but_copyKPToSpecificLocationInstallButton" label="%-KeeFox_Install_copyKPToSpecificLocationInstallButton.label-%"
oncommand="copyKPToSpecificLocationInstall();"/>
</vbox>
</vbox>

<vbox id="nonAdminSetupKPInstallExpandee" hidden="true">
<description id="desc_nonAdminSetupKPInstallExpandee">%-KeeFox_Install_nonAdminSetupKPInstallExpandee.description-%</description>
<vbox id="KPsetupExeSilentInstallButton" hidden="false">
<button id="but_KPsetupExeSilentInstallButton" label="%-KeeFox_Install_KPsetupExeSilentInstallButton.label-%"
oncommand="KPsetupExeSilentInstall();"/>
</vbox>
<vbox id="KPsetupExeInstallButton" hidden="false">
<button id="but_KPsetupExeInstallButton" label="%-KeeFox_Install_KPsetupExeInstallButton.label-%"
oncommand="KPsetupExeInstall();"/>
</vbox>

</vbox>

<vbox id="nonAdmincopyKRPCToKnownKPLocationInstallExpandee" hidden="true">
<description id="desc_nonAdmincopyKRPCToKnownKPLocationInstallExpandee">%-KeeFox_Install_nonAdmincopyKRPCToKnownKPLocationInstallExpandee.description-%</description>
<vbox id="nonAdmincopyKRPCToKnownKPLocationInstallButton" hidden="false">
<!-- file chooser field needed -->
<button id="but_nonAdmincopyKRPCToKnownKPLocationInstallButton" label="%-KeeFox_Install_nonAdmincopyKRPCToKnownKPLocationInstallButton.label-%"
oncommand="copyKPToSpecificLocationInstall();"/>
</vbox>
</vbox>

</vbox>


<!-- everything in this box is displayed during the installation process -->
<vbox id="installProgressView" hidden="true">
<vbox id="IC1setupNETdownloading" hidden="true">
<description id="desc_IC1setupNETdownloading">%-KeeFox_Install_IC1setupNETdownloading.description-%</description>
<html:progress max="100" id="IC1setupNETdownloadingProgressBar" mode="determined" value="0"/>
<button id="but_IC1setupNETdownloading" label="%-KeeFox_Install_Cancel_Button.label-%"
oncommand="cancelCurrentDownload();"/>
</vbox>
<vbox id="IC1setupNETdownloaded" hidden="true">
<description id="desc_IC1setupNETdownloaded">%-KeeFox_Install_IC1setupNETdownloaded.description-%</description>
</vbox>

<vbox id="IC1setupKPdownloading" hidden="true">
<description id="desc_IC1setupKPdownloading">%-KeeFox_Install_IC1setupKPdownloading.description-%</description>
<html:progress max="100" id="IC1setupKPdownloadingProgressBar" mode="determined" value="0"/>
<button id="but_IC1setupKPdownloading" label="%-KeeFox_Install_Cancel_Button.label-%"
oncommand="cancelCurrentDownload();"/>
</vbox>
<vbox id="IC1setupKPdownloaded" hidden="true">
<description id="desc_IC1setupKPdownloaded">%-KeeFox_Install_IC1setupKPdownloaded.description-%</description>
</vbox>

<vbox id="IC1KRPCdownloaded" hidden="true">
<description id="desc_IC1KRPCdownloaded">%-KeeFox_Install_IC1KRPCdownloaded.description-%</description>
</vbox>

<vbox id="IC2setupKPdownloading" hidden="true">
<description id="desc_IC2setupKPdownloading">%-KeeFox_Install_IC2setupKPdownloading.description-%</description>
<html:progress max="100" id="IC2setupKPdownloadingProgressBar" mode="determined" value="0"/>
<button id="but_IC2setupKPdownloading" label="%-KeeFox_Install_Cancel_Button.label-%"
oncommand="cancelCurrentDownload();"/>
</vbox>
<vbox id="IC2setupKPdownloaded" hidden="true">
<description id="desc_IC2setupKPdownloaded">%-KeeFox_Install_IC2setupKPdownloaded.description-%</description>
</vbox>

<vbox id="IC2KRPCdownloaded" hidden="true">
<description id="desc_IC2KRPCdownloaded">%-KeeFox_Install_IC2KRPCdownloaded.description-%</description>
</vbox>

<vbox id="IC3installing" hidden="true">
<description id="desc_IC3installing">%-KeeFox_Install_IC3installing.description-%</description>
</vbox>

<vbox id="IC5zipKPdownloading" hidden="true">
<description id="desc_IC5zipKPdownloading">%-KeeFox_Install_IC5zipKPdownloading.description-%</description>
<html:progress max="100" id="IC5zipKPdownloadingProgressBar" mode="determined" value="0"/>
<button id="lab_IC5zipKPdownloading" label="%-KeeFox_Install_Cancel_Button.label-%"
oncommand="cancelCurrentDownload();"/>
</vbox>
<vbox id="IC5zipKPdownloaded" hidden="true">
<description id="desc_IC5zipKPdownloaded">%-KeeFox_Install_IC5zipKPdownloaded.description-%</description>
</vbox>

<vbox id="IC5installing" hidden="true">
<description id="desc_IC5installing">%-KeeFox_Install_IC5installing.description-%</description>
</vbox>

</vbox>

<!-- everything in this box is displayed when everything is installed correctly -->
<vbox id="InstallFinished" hidden="true">
<description id="desc_InstallFinished">%-KeeFox_Install_InstallFinished-2014.description-%</description>
<description id="nextStepsIntro">%-KeeFox_Install_NextSteps.description-%</description>
<hbox width="500px">
<description id="nextStep1" width="50px">1)</description>
<description id="desc_nextStep1" width="450px">%-KeeFox_Install_NextStep1.description-%</description>
</hbox>
<hbox width="500px">
<description id="nextStep2" width="50px">2)</description>
<label width="450px" id="nextStepsTutorialLink" href="http://tutorial.keefox.org/part1?utm_source=firefoxAddon&amp;utm_medium=postInstall" class="text-link">%-KeeFox_Install_NextStep2.description-%</label>
</hbox>
<hbox width="500px">
<description id="nextStep3" width="50px">3)</description>
<label width="450px" id="nextStepsImportLink" href="http://keefox.org/migration" class="text-link">%-KeeFox_Install_NextStep3.description-%</label>
</hbox>

<description id="nextStepsFinally">%-KeeFox_Install_Finally.description-% <label href="http://keefox.org/help" class="text-link">http://keefox.org/help</label></description>
</vbox>

<!-- everything in this box is displayed when everything is upgraded correctly -->
<vbox id="UpgradeFinished" hidden="true">
<description style="margin-bottom:10px;" id="desc_UpgradeFinished">%-KeeFox_Install_UpgradeFinished.description-%</description>
<description id="nextStepsUpgradeFinally">
%-KeeFox_Install_Finally.description-% <label href="http://keefox.org/help" class="text-link">http://keefox.org/help</label>
</description>
</vbox>
</vbox> <!-- end KFInstallPageContent -->
</vbox> <!-- end KFInstallPageMain -->

<spacer flex="1"/>
</row>
</rows>
</grid>

</window>`);
    window.prepareInstallPage();
//prepareInstallPage
//chrome://keefox/skin/install.css
}

function onUnload(deactivatedWhileWindowOpen) {
  // Cleaning up the window UI is only needed when the
  // add-on is being deactivated/removed while the window
  // is still open. It can be skipped otherwise.
  if (!deactivatedWhileWindowOpen) {
    return
  }
}