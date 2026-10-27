// Forget the content purpose of a text field once it loses focus.
//
// gnome-shell routes every Wayland text-input client through a single IBus
// context and keeps the last content purpose it was given. A client that
// never sends one (WezTerm's text-input-v3 only sends enable + commit)
// inherits the previous field's purpose on focus-in. After a password field
// (the lock screen, a polkit dialog, a browser login) WezTerm therefore
// counts as a password field too: gnome-shell drops the IBus input sources,
// and Ctrl+Space (switch-input-source) has nothing left to switch to until
// some other text field sends a purpose of its own.
//
// _fullReset() is only called from vfunc_focus_out, so hooking this plain
// JS method covers exactly the focus-out path without touching the vfunc.
//
// "unlock-dialog" in metadata.json keeps the hook installed while the screen
// is locked; otherwise the lock screen's password field, the most common
// trigger, would leave its purpose behind before the extension is re-enabled.

import IBus from 'gi://IBus';

import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import {InputMethod} from 'resource:///org/gnome/shell/misc/inputMethod.js';

export default class ResetImePurposeExtension extends Extension {
    enable() {
        this._injections = new InjectionManager();
        this._injections.overrideMethod(InputMethod.prototype, '_fullReset',
            original => function () {
                // vfunc_focus_out clears _currentFocus first; leave a
                // still-focused field's purpose alone if that ever changes.
                if (!this._currentFocus) {
                    this._purpose = IBus.InputPurpose.FREE_FORM;
                    this._hints = IBus.InputHints.NONE;
                }
                original.call(this);
            });
    }

    disable() {
        this._injections.clear();
        this._injections = null;
    }
}
