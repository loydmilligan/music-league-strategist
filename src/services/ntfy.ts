// ntfy Push Notification Service (Feature 5)
// https://ntfy.sh documentation: https://docs.ntfy.sh/

import { useSettingsStore } from '@/stores/settingsStore'

export type NtfyPriority = 'min' | 'low' | 'default' | 'high' | 'urgent'

export interface NtfyNotification {
  title: string
  message: string
  priority?: NtfyPriority
  tags?: string[]
  click?: string  // URL to open when notification is clicked
}

class NtfyService {
  private getConfig() {
    const { ntfy } = useSettingsStore.getState()
    return ntfy
  }

  isConfigured(): boolean {
    const config = this.getConfig()
    return config.enabled && Boolean(config.topic)
  }

  async sendNotification(notification: NtfyNotification): Promise<boolean> {
    const config = this.getConfig()

    if (!this.isConfigured()) {
      console.warn('[ntfy] Not configured, skipping notification')
      return false
    }

    const url = `${config.serverUrl}/${config.topic}`

    try {
      const headers: Record<string, string> = {
        'Title': notification.title,
      }

      if (notification.priority) {
        headers['Priority'] = notification.priority
      }

      if (notification.tags && notification.tags.length > 0) {
        headers['Tags'] = notification.tags.join(',')
      }

      if (notification.click) {
        headers['Click'] = notification.click
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: notification.message,
      })

      if (!response.ok) {
        console.error('[ntfy] Failed to send notification:', response.statusText)
        return false
      }

      console.log('[ntfy] Notification sent:', notification.title)
      return true
    } catch (error) {
      console.error('[ntfy] Error sending notification:', error)
      return false
    }
  }

  // Convenience methods for common notification types

  async sendDeadlineReminder(
    themeName: string,
    hoursRemaining: number
  ): Promise<boolean> {
    let priority: NtfyPriority = 'default'
    let tags: string[] = ['clock']

    if (hoursRemaining <= 1) {
      priority = 'urgent'
      tags = ['warning', 'clock']
    } else if (hoursRemaining <= 4) {
      priority = 'high'
      tags = ['warning', 'clock']
    } else if (hoursRemaining <= 12) {
      priority = 'default'
    } else {
      priority = 'low'
    }

    const timeText = hoursRemaining <= 1
      ? `${Math.round(hoursRemaining * 60)} minutes`
      : hoursRemaining < 24
        ? `${Math.round(hoursRemaining)} hours`
        : `${Math.round(hoursRemaining / 24)} days`

    return this.sendNotification({
      title: hoursRemaining <= 1
        ? `URGENT: ${themeName}`
        : `Music League Deadline`,
      message: `"${themeName}" deadline in ${timeText}!`,
      priority,
      tags,
    })
  }

  async sendPhaseMilestone(
    themeName: string,
    _phase: string,  // Reserved for future use
    description: string
  ): Promise<boolean> {
    return this.sendNotification({
      title: 'Music League Progress',
      message: `${themeName}: ${description}`,
      priority: 'default',
      tags: ['white_check_mark', 'musical_note'],
    })
  }

  async sendTestNotification(): Promise<boolean> {
    return this.sendNotification({
      title: 'Music League Strategist',
      message: 'Test notification - ntfy is configured correctly!',
      priority: 'default',
      tags: ['tada'],
    })
  }
}

export const ntfyService = new NtfyService()
