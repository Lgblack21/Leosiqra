package com.leosiqra.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin lokal (bukan dari npm) harus didaftarkan sebelum super.onCreate.
        registerPlugin(EmoneyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
