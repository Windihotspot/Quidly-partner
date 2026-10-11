// src/stores/eventsStore.js
// Holds the partner's event list only. Wizard steps own their own state.
import { defineStore } from 'pinia'
import { eventsService, apiError } from '@/services/eventsService'

export const useEventsStore = defineStore('events', {
  state: () => ({ events: [], loading: false, error: null }),

  actions: {
    async fetchEvents() {
      this.loading = true
      this.error = null
      try {
        const res = await eventsService.list()
        this.events = res.events ?? []
      } catch (e) {
        this.error = apiError(e, 'Could not load your events.')
      } finally {
        this.loading = false
      }
    },

    _patch(id, fields) {
      const i = this.events.findIndex((e) => e.id === id)
      if (i !== -1) this.events[i] = { ...this.events[i], ...fields }
    },

    async publish(id) {
      const res = await eventsService.publish(id)
      this._patch(id, { status: res.event.status, published_at: res.event.published_at })
      return res
    },

    async unpublish(id) {
      const res = await eventsService.unpublish(id)
      this._patch(id, { status: res.event.status })
      return res
    },

    async removeDraft(id) {
      await eventsService.deleteDraft(id)
      this.events = this.events.filter((e) => e.id !== id)
    },
  },
})
