//
//  AppDelegate.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
  var statusItem: NSStatusItem?
  var jikoMenu: JikoMenu!
  
  func applicationDidFinishLaunching(_ notification: Notification) {
    // Dock icon visible by default
    
    // Menu-bar item
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    statusItem?.button?.title = "Jiko"
    
    jikoMenu = JikoMenu()
    statusItem?.menu = jikoMenu.constructMenu()
  }
}
