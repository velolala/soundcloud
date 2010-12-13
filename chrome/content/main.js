/* *=BEGIN SONGBIRD GPL
 *
 * This file is part of the Songbird web player.
 *
 * Copyright(c) 2005-2010 POTI, Inc.
 * http://www.songbirdnest.com
 *
 * This file may be licensed under the terms of of the
 * GNU General Public License Version 2 (the ``GPL'').
 *
 * Software distributed under the License is distributed
 * on an ``AS IS'' basis, WITHOUT WARRANTY OF ANY KIND, either
 * express or implied. See the GPL for the specific language
 * governing rights and limitations.
 *
 * You should have received a copy of the GPL along with this
 * program. If not, go to http://www.gnu.org/licenses/gpl.html
 * or write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 *
 *=END SONGBIRD GPL
 */

Cu.import("resource://app/jsmodules/DOMUtils.jsm");
Cu.import("resource://app/jsmodules/sbProperties.jsm");

// Create a namespace
if (typeof SoundCloud == 'undefined')
  var SoundCloud = {};

/**
 *
 */
SoundCloud.SB_NS = "http://songbirdnest.com/data/1.0#";
SoundCloud.SP_NS = "http://songbirdnest.com/rdf/servicepane#";

SoundCloud.URL_SIGNUP = 'http://soundcloud.com/signup';
SoundCloud.URL_PASSWORD = 'https://soundcloud.com/login/forgot';

SoundCloud.Icons = {
  busy: 'chrome://soundcloud/skin/busy.png',
  disabled: 'chrome://soundcloud/skin/disabled.png',
  logged_in: 'chrome://soundcloud/skin/sc.png'
};

SoundCloud.onLoad = function SoundCloud_onLoad() {
  // initialization code
  this._strings = document.getElementById("soundcloud-strings");

  this._service = Cc["@songbirdnest.com/soundcloud;1"]
                    .getService().wrappedJSObject;
  this._service.listeners.add(this);

  this._statusIcon = document.getElementById('soundcloudStatusIcon');
  this._panelBinding = document.getElementById('soundcloudLoginPanel');
  this._panel = this._getElement(this._panelBinding, 'loginPanel');
  this._deck = this._getElement(this._panelBinding, 'loginDeck');
  this._login = this._getElement(this._panelBinding, 'loginBox');
  this._username = this._getElement(this._panelBinding, 'username');
  // Hacky solution to increase max length of username field
  this._username.setAttribute("maxlength", 255);
  this._password = this._getElement(this._panelBinding, 'password');
  this._loginAutoLogin = this._getElement(this._panelBinding,
                                          'loginAutoLogin');
  this._loginButton = this._getElement(this._panelBinding, 'loginButton');
  this._newAccountGroupbox = this._getElement(this._panelBinding,
                                              'newAccountGroupbox');
  this._loginError = this._getElement(this._panelBinding, 'loginError');
  this._loggingIn = this._getElement(this._panelBinding, 'loginProgressBox');
  this._cancelButton = this._getElement(this._panelBinding, 'cancelButton');

  this._signupButton = this._getElement(this._panelBinding, 'signupButton');

  this._forgotpass = this._getElement(this._panelBinding, 'forgotpass');
  this._forgotpass.textContent =
         this._strings.getString('soundcloud.forgotpass.label');

  this._profile = this._getElement(this._panelBinding, 'profileBox');
  this._image = this._getElement(this._panelBinding, 'image');
  this._realname = this._getElement(this._panelBinding, 'realname');
  this._citycountry = this._getElement(this._panelBinding, 'profileDescription');
  this._profileAutoLogin = this._getElement(this._panelBinding,
                                            'profileAutoLogin');

  var self = this;
  this._domEventListenerSet = new DOMEventListenerSet();

  var onProfileUrlClicked = function(event) {
    self.loadURI(self._service.profileurl, event);
  }

  // Wire up UI events for the profile links
  this._domEventListenerSet.add(this._image,
                                'click',
                                onProfileUrlClicked,
                                false,
                                false);
  this._domEventListenerSet.add(this._realname,
                                'click',
                                onProfileUrlClicked,
                                false,
                                false);

  this._domEventListenerSet.add(this._citycountry,
                                'click',
                                function() { dump(self._citycountry); },
                                false,
                                false);

  // Wire up click event for the status icon
  this._statusIcon.addEventListener('click',
    function(event) {
    // Only the left button
      if (event.button != 0) return;
      SoundCloud.showPanel();
    }, false);

  // wire up the signup link
  var onSignupButtonClicked = function(event) {
    self.loadURI(self.URL_SIGNUP, event);
  };
  this._domEventListenerSet.add(this._signupButton,
                                'click',
                                onSignupButtonClicked,
                                false,
                                false);

  // wire up the forgot password link
  var onForgotpass = function(event) {
    self.loadURI(self.URL_PASSWORD, event);
  };
  this._domEventListenerSet.add(this._forgotpass,
                                'click',
                                onForgotpass,
                                false,
                                false);

  var onButtonClicked = function(event) { self._handleUIEvents(event); };
  this._domEventListenerSet.add(this._panelBinding,
                                'login-button-clicked',
                                onButtonClicked,
                                false,
                                false);
  this._domEventListenerSet.add(this._panelBinding,
                                'cancel-button-clicked',
                                onButtonClicked,
                                false,
                                false);
  this._domEventListenerSet.add(this._panelBinding,
                                'logout-button-clicked',
                                onButtonClicked,
                                false,
                                false);

  // copy the username & password out of the service into the UI
  this._username.value = this._service.username;
  this._password.value = this._service.password;

  // Initially disable the login button if no username or password value
  if (!this._username.value || !this._password.value) {
    this._loginButton.disabled = true;
  }

  this.onLoggedInStateChanged();

  // Attach our listener to the ShowCurrentTrack event issued by the
  // faceplate
  var faceplateManager = Cc['@songbirdnest.com/faceplate/manager;1'].
    getService(Ci.sbIFaceplateManager);
  var pane = faceplateManager.getPane("songbird-dashboard");
  var sbWindow = Cc["@mozilla.org/appshell/window-mediator;1"].
    getService(Ci.nsIWindowMediator).
    getMostRecentWindow("Songbird:Main").window;
  sbWindow.addEventListener("ShowCurrentTrack", this.curTrackListener, true);

  // Create our properties if they don't exist
  var pMgr = Cc["@songbirdnest.com/Songbird/Properties/PropertyManager;1"].
    getService(Ci.sbIPropertyManager);

  if (!pMgr.hasProperty(SBProperties.trackName)) {
    var pI = Cc["@songbirdnest.com/Songbird/Properties/Info/Text;1"]
               .createInstance(Ci.sbITextPropertyInfo);
    pI.id = SBProperties.trackName;
    pI.displayName = this._strings.getString("trackName");
    pI.userEditable = false;
    pI.userViewable = false;
    pMgr.addPropertyInfo(pI);
  }

  if (!pMgr.hasProperty(SBProperties.duration)) {
    var pI = Cc["@songbirdnest.com/Songbird/Properties/Info/Number;1"]
               .createInstance(Ci.sbINumberPropertyInfo);
    pI.id = SBProperties.duration;
    pI.displayName = this._strings.getString("duration");
    pI.userEditable = false;
    pI.userViewable = false;
    pMgr.addPropertyInfo(pI);
  }

  if (!pMgr.hasProperty(SB_PROPERTY_USER)) {
    var pI = Cc["@songbirdnest.com/Songbird/Properties/Info/Text;1"]
               .createInstance(Ci.sbITextPropertyInfo);
    pI.id = SB_PROPERTY_USER;
    pI.displayName = this._strings.getString("user");
    pI.userEditable = false;
    pI.userViewable = false;
    pMgr.addPropertyInfo(pI);
  }

  if (!pMgr.hasProperty(SB_PROPERTY_PLAYS)) {
    var pI = Cc["@songbirdnest.com/Songbird/Properties/Info/Text;1"]
               .createInstance(Ci.sbITextPropertyInfo);
    pI.id = SB_PROPERTY_PLAYS;
    pI.displayName = " ";
    pI.userEditable = false;
    pI.userViewable = false;
    pMgr.addPropertyInfo(pI);
  }

  if (!pMgr.hasProperty(SB_PROPERTY_FAVS)) {
    var pI = Cc["@songbirdnest.com/Songbird/Properties/Info/Text;1"]
               .createInstance(Ci.sbITextPropertyInfo);
    pI.id = SB_PROPERTY_FAVS;
    pI.displayName = " ";
    pI.userEditable = false;
    pI.userViewable = false;
    pMgr.addPropertyInfo(pI);
  }
}

SoundCloud.showPanel = function SoundCloud_showPanel() {
  this._panel.openPopup(this._statusIcon);
}

SoundCloud._handleUIEvents =
function SoundCloud__handlUIEvents(aEvent) {
  switch (aEvent.type) {
    case "login-button-clicked":
      this._service.userLoggedOut = false;
      this._service.username = this._username.value;
      this._service.password = this._password.value;
      // call login, telling the service to ignore any saved sessions
      this._service.login(true);
      break;
    case "cancel-button-clicked":
      this._service.cancelLogin();
      this._service.userLoggedOut = true;
      break;
    case "logout-button-clicked":
      this.onLogoutClick(aEvent);
      break;
    default:
      break;
  }

  if (this._service.userLoggedOut) {
    this._newAccountGroupbox.removeAttribute('loggedOut');
  } else {
    this._newAccountGroupbox.setAttribute('loggedOut', 'false');
  }
}

SoundCloud.onProfileUpdated = function SoundCloud_onProfileUpdated() {
  var avatar = 'chrome://soundcloud/skin/default-avatar.png';
  if (this._service.avatar) {
    avatar = this._service.avatar;
  }
  this._image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', avatar);
  if (this._service.realname && this._service.realname.length) {
    this._realname.textContent = this._service.realname;
  } else {
    this._realName.textContent = this._username;
  }
  this._citycountry.textContent = this._service.city + ", " +
                                  this._service.country;
}

SoundCloud.onCancelClick = function SoundCloud_onCancelClick(event) {
  this._deck.selectedPanel = this._login;
}

SoundCloud.onLogoutClick = function SoundCloud_onLogoutClick(event) {
  this._service.userLoggedOut = true;
  this._service.logout();
  this.setLoginError(null);
  this.updateStatus();
}

SoundCloud.loadURI = function SoundCloud_loadURI(uri, event) {
  gBrowser.loadURI(uri, null, null, event, '_blank');
  this._panel.hidePopup();
}

// SoundCloud event handlers for login events
SoundCloud.onLoggedInStateChanged =
function SoundCloud_onLoggedInStateChanged() {
  if (this._service.loggedIn) {
    this._deck.selectedPanel = this._profile;
  } else {
    this._deck.selectedPanel = this._login;
  }

  this.updateStatus();
}

SoundCloud.onLoginBegins = function SoundCloud_onLoginBegins() {
  this._deck.selectedPanel = this._loggingIn;
  this.setStatusIcon(this.Icons.busy);
  //this.setStatusTextId('soundcloud.state.logging_in');
}

SoundCloud.onLoginCancelled = function SoundCloud_onLoginCancelled() {
  this.setLoginError(null);
}

SoundCloud.onItemsAdded = function SoundCloud_onItemsAdded() {
  Cu.reportError("SOUNDCLOUD ITEMS ADDED");
}

SoundCloud.updateStatus = function SoundCloud_updateStatus() {
  if (this._service.loggedIn) {
    this.setStatusIcon(this.Icons.logged_in);
    //this.setStatusTextId('soundcloud.state'+stateName);
  } else {
    this.setStatusIcon(this.Icons.disabled);
  }
}

SoundCloud.setStatusIcon = function SoundCloud_setStatusIcon(aIcon) {
  this._statusIcon.setAttribute('src', aIcon);
}

SoundCloud.setStatusText = function SoundCloud_setStatusText(aText) {
  this._statusIcon.setAttribute('tooltip', aText);
}

SoundCloud.setStatusText = function SoundCloud_setStatusText(aId) {
  this._statusIcon.setStatusText(this._strings.getString(aId));
}

SoundCloud.setLoginError = function SoundCloud_setLoginError(aText) {
  if (aText) {
    this._loginError.textContent = aText;
    this._loginError.style.visibility = 'visible';
  } else {
    this._loginError.textContent = '';
    this._loginError.style.visibility = 'collapse';
  }
}

SoundCloud.curTrackListener =
function SoundCloud_curTrackListener(aEvent) {

}

SoundCloud.uninstallObserver = {

}

SoundCloud._getElement =
function SoundCloud__getElement(aWidget, aElementID) {
  return document.getAnonymousElementByAttribute(aWidget, "sbid", aElementID);
}

SoundCloud.onUnload = function SoundCloud_onUnload() {
  this._service.listeners.remove(this);

  if (this._domEventListenerSet) {
    this._domEventListenerSet.removeAll();
    this._domEventListenerSet = null;
  }
}

window.addEventListener("load",
                        function(e) { SoundCloud.onLoad(e); }, false);
window.addEventListener("unload",
                        function(e) { SoundCloud.onUnload(e); }, false);
