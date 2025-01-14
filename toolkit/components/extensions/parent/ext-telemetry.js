/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.defineModuleGetter(
  this,
  "TelemetryController",
  "resource://gre/modules/TelemetryController.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "TelemetryUtils",
  "resource://gre/modules/TelemetryUtils.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "Services",
  "resource://gre/modules/Services.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "ExtensionUtils",
  "resource://gre/modules/ExtensionUtils.jsm"
);

const SCALAR_TYPES = {
  count: Ci.nsITelemetry.SCALAR_TYPE_COUNT,
  string: Ci.nsITelemetry.SCALAR_TYPE_STRING,
  boolean: Ci.nsITelemetry.SCALAR_TYPE_BOOLEAN,
};

// Currently unsupported on Android: blocked on 1220177.
// See 1280234 c67 for discussion.
function desktopCheck() {
  if (AppConstants.MOZ_BUILD_APP !== "browser") {
    throw new ExtensionUtils.ExtensionError(
      "This API is only supported on desktop"
    );
  }
}

this.telemetry = class extends ExtensionAPI {
  getAPI(context) {
    return {
      telemetry: {
        submitPing(type, payload, options) {
          desktopCheck();
          try {
            TelemetryController.submitExternalPing(type, payload, options);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        canUpload() {
          desktopCheck();
          // Note: remove the ternary and direct pref check when
          // TelemetryController.canUpload() is implemented (bug 1440089).
          try {
            const result =
              "canUpload" in TelemetryController
                ? TelemetryController.canUpload()
                : Services.prefs.getBoolPref(
                    TelemetryUtils.Preferences.FhrUploadEnabled,
                    false
                  );
            return result;
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        scalarAdd(name, value) {
          desktopCheck();
          try {
            Services.telemetry.scalarAdd(name, value);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        scalarSet(name, value) {
          desktopCheck();
          try {
            Services.telemetry.scalarSet(name, value);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        scalarSetMaximum(name, value) {
          desktopCheck();
          try {
            Services.telemetry.scalarSetMaximum(name, value);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        recordEvent(category, method, object, value, extra) {
          desktopCheck();
          try {
            Services.telemetry.recordEvent(
              category,
              method,
              object,
              value,
              extra
            );
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        registerScalars(category, data) {
          desktopCheck();
          try {
            // For each scalar in `data`, replace scalar.kind with
            // the appropriate nsITelemetry constant.
            Object.keys(data).forEach(scalar => {
              data[scalar].kind = SCALAR_TYPES[data[scalar].kind];
            });
            Services.telemetry.registerScalars(category, data);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        setEventRecordingEnabled(category, enabled) {
          desktopCheck();
          try {
            Services.telemetry.setEventRecordingEnabled(category, enabled);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
        registerEvents(category, data) {
          desktopCheck();
          try {
            Services.telemetry.registerEvents(category, data);
          } catch (ex) {
            throw new ExtensionUtils.ExtensionError(ex);
          }
        },
      },
    };
  }
};
