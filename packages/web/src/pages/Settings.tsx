import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import { UserPreferences, StyleProfile } from '../types';
import { getStyleLabel } from '../utils/formatting';

const topics = [
  'Politics',
  'Technology',
  'Business',
  'Science',
  'Health',
  'Sports',
  'Entertainment',
  'World',
  'Climate',
  'Education',
];

export const Settings: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const data = await apiClient.getPreferences();
        setPreferences(data);
      } catch (err: any) {
        setMessage({
          type: 'error',
          text: err.response?.data?.message || 'Failed to load preferences',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      await apiClient.updatePreferences(preferences);
      setMessage({ type: 'success', text: 'Preferences saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save preferences',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (topic: string, listType: 'followed' | 'muted') => {
    if (!preferences) return;

    const list = listType === 'followed' ? preferences.followedTopics : preferences.mutedTopics;
    const otherList =
      listType === 'followed' ? preferences.mutedTopics : preferences.followedTopics;

    const newList = list.includes(topic)
      ? list.filter((t) => t !== topic)
      : [...list, topic];

    // Remove from other list if it exists there
    const newOtherList = otherList.filter((t) => t !== topic);

    setPreferences({
      ...preferences,
      [listType === 'followed' ? 'followedTopics' : 'mutedTopics']: newList,
      [listType === 'followed' ? 'mutedTopics' : 'followedTopics']: newOtherList,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          Failed to load preferences
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Customize your news reading experience</p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Reading Preferences</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Reading Style
              </label>
              <select
                value={preferences.preferredStyle}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    preferredStyle: e.target.value as StyleProfile,
                  })
                }
                className="input"
              >
                <option value="original">Original</option>
                <option value="conversational">Conversational</option>
                <option value="academic">Academic</option>
                <option value="bullet-point">Bullet Points</option>
                <option value="eli5">ELI5 (Explain Like I'm 5)</option>
                <option value="executive">Executive Brief</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Articles will be rewritten in this style by default
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Reading Time (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={preferences.readingTimePreference || 10}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    readingTimePreference: parseInt(e.target.value),
                  })
                }
                className="input"
              />
              <p className="mt-1 text-sm text-gray-500">
                We'll prioritize articles that match your reading time
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Topics</h2>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Followed Topics</h3>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic, 'followed')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    preferences.followedTopics.includes(topic)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Selected topics will appear more frequently in your feed
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Muted Topics</h3>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic, 'muted')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    preferences.mutedTopics.includes(topic)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Selected topics will be hidden from your feed
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Push Notifications</p>
                <p className="text-sm text-gray-500">
                  Get notified about breaking news on followed topics
                </p>
              </div>
              <button
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    notificationsEnabled: !preferences.notificationsEnabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.notificationsEnabled ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Daily Email Digest</p>
                <p className="text-sm text-gray-500">
                  Receive a daily summary of top stories in your preferred style
                </p>
              </div>
              <button
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    emailDigest: !preferences.emailDigest,
                  })
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.emailDigest ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    preferences.emailDigest ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
