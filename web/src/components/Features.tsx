import React from 'react';
import { MdChatBubble } from 'react-icons/md'
import { FaBrain, FaRobot } from 'react-icons/fa';

const Features = () => {
  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-12">How Jiko Works</h2>

        {/* Core Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Feature 1: Human-like Messaging */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition">
            <MdChatBubble className="text-blue-600 text-4xl mb-4" />
            <h3 className="text-xl font-semibold mb-3">Human-Like iMessage Coaching</h3>
            <p className="mb-4">
              {"Jiko sends real iMessage/SMS prompts (no app needed) that mimic a human mentor. Harder to ignore than push notifications or app alerts."}
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Feels like a personal accountability partner</li>
              <li>• Built on iOS/macOS message APIs for native feel</li>
            </ul>
          </div>

          {/* Feature 2: Smart Automation */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition">
            <FaBrain className="text-green-600 text-4xl mb-4" />
            <h3 className="text-xl font-semibold mb-3">Real-Time Behavioral Triggers</h3>
            <p className="mb-4">
              {"Triggers based on phone/laptop usage, location, health, and app activity (e.g., \"You’ve opened LinkedIn 5x—time to apply\")."}
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Integrates with health, calendar, and app usage data</li>
              <li>• Custom rules for apps like Instagram, Slack, or VSCode</li>
            </ul>
          </div>

          {/* Feature 3: Customizable Interventions */}
          <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition">
            <FaRobot className="text-purple-600 text-4xl mb-4" />
            <h3 className="text-xl font-semibold mb-3">Flexible Automation & Overrides</h3>
            <p className="mb-4">
              Control when/why Jiko nudges you with tiered automation modes and manual overrides.
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>{"• Choose \"Strict\" or \"Lenient\" automation profiles"}</li>
              <li>{"• Whitelist/blacklist apps/times (e.g., \"No messages during gym sessions\")"}</li>
            </ul>
          </div>
        </div>

        {/* Advanced Feature: Custom Actions */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-center mb-8">Advanced Custom Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-3">Deadline-Only Alerts</h4>
              <p className="text-gray-700">
                Only get nudged for critical tasks like exam prep or assignment submissions.
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg">
              <h4 className="text-xl font-semibold mb-3">Habit Tracking Integrations</h4>
              <p className="text-gray-700">
                {"Track habits like \"Guitar Practice\" or \"Journaling\" via automated prompts or screen-time data."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;