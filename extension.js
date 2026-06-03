import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gvc from 'gi://Gvc';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class VolumePercentageExtension extends Extension {
    enable() {
        this._mixer = new Gvc.MixerControl({ name: this.uuid });
        this._mixer.connect('default-sink-changed', this._onSinkChanged.bind(this));
        this._mixer.open();

        // Add self after battery percentage, the first item in the quick settings menu header
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._label = new St.Label({
                text: '--%',
                y_align: Clutter.ActorAlign.CENTER,
                style: 'margin: 0 6px;',
            });

            const menu = Main.panel.statusArea.quickSettings.menu;
            const systemItem = menu._grid.get_first_child();
            const header = systemItem.get_first_child();
            header.insert_child_at_index(this._label, 1);
            this._update();

            this._idleId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onSinkChanged(mixer) {
        // Remove old sinks
        if (this._volumeId) {
            this._sink?.disconnect(this._volumeId);
        }

        if (this._mutedId) {
            this._sink?.disconnect(this._mutedId);
        }

        this._sink = mixer.get_default_sink();
        if (!this._sink) return;

        this._volumeId = this._sink.connect('notify::volume', () => this._update());
        this._mutedId = this._sink.connect('notify::is-muted', () => this._update());
        this._update();
    }

    _update() {
        if (!this._label || !this._sink) return;

        const volumePercent = Math.round(this._sink.get_volume() / this._mixer.get_vol_max_norm() * 100);
        this._label.text = this._sink.get_is_muted() ? '0%' : `${volumePercent}%`;
    }

    disable() {
        if (this._idleId) {
            GLib.source_remove(this._idleId);
        };

        this._idleId = 0;

        if (this._sink) {
            if (this._volumeId) this._sink.disconnect(this._volumeId);
            if (this._mutedId) this._sink.disconnect(this._mutedId);
        }
        
        this._sink = null;
        this._mixer?.close();
        this._mixer = null;

        this._label?.destroy();
        this._label = null;
    }
}
