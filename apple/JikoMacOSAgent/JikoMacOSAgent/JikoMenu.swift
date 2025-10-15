//
//  ContentView.swift
//  JikoMacOSAgent
//
//  Created by Hadi Ahmad on 10/15/25.
//

import SwiftUI
import Cocoa

class JikoMenu: NSObject, NSMenuDelegate {
  @Published var quitClicksRemaining: Int = 3
  var menu: NSMenu!
  
//  static let quitTitles: [String] = [
//    "(Quit) Jiko will remember this", "(Quit) bitch ass", "(Quit) are we serious bruh"
//  ]
  
  
  func constructMenu() -> NSMenu {
    let menu = NSMenu()
    menu.delegate = self
    menu.autoenablesItems = false
    
    // Jiko Status
    let status = NSMenuItem(title: "Jiko is running!", action: nil, keyEquivalent: "")
    menu.addItem(status)
    
    // Version + Build
    let versionRow = NSMenuItem(title: "Version ? (Build ?)", action: nil, keyEquivalent: "")
    if let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
       let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
        versionRow.title = "Version \(version) (Build \(build))"
    }
    menu.addItem(versionRow)
    
    //------------------------------------------------------------
    menu.addItem(NSMenuItem.separator())
    
    // Currently Focused App
    let focusedAppRow = NSMenuItem(title: "Active: N/A", action: nil, keyEquivalent: "")
    focusedAppRow.title = "Not supported yet"
    menu.addItem(focusedAppRow)
    
    // Today's Screen Time Duration
    let screenTimeRow = NSMenuItem(title: "Screen Time: ...", action: nil, keyEquivalent: "")
    screenTimeRow.title = "Not supported yet"
    menu.addItem(screenTimeRow)
    
    //------------------------------------------------------------
    menu.addItem(NSMenuItem.separator())
    
    // Actions
    
    let quit = NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q")
    quit.tag = 67
    quit.target = self
    menu.addItem(quit)
    
    self.menu = menu
    return menu
  }
  
  @objc func dummyAction() {
    print("Dummy Action triggered")
  }
   
  @objc func quit() {
//    if self.quitClicksRemaining > 0 {
//      self.quitClicksRemaining -= 1
//      if let quitRow = menu.item(withTag: 67) {
//        quitRow.title = JikoMenu.quitTitles[quitClicksRemaining]
//      }
//      return
//    }
    NSApp.terminate(nil)
  }
}
