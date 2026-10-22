const app = getApp();

Page({
  data: { venue: {}, label: '', contact: {}, routes: [], markers: [], polyline: [] },

  onShow() {
    app.ready((c) => {
      const v = c.venue;
      // 场地名、厅名只填了一个或都没填时，不出现孤零零的「·」
      const label = [v.name, v.hall].filter(Boolean).join(' · ');
      this.setData({
        venue: v,
        label,
        contact: c.contact,
        routes: c.routes.map((r) => ({ ...r, iconPath: `/images/ico-${r.icon || 'info'}.png` })),
        markers: [{
          id: 1,
          latitude: v.latitude,
          longitude: v.longitude,
          title: label || v.address || '',
          width: 36,
          height: 36,
          callout: label ? {
            content: label,
            display: 'ALWAYS', padding: 8, borderRadius: 8,
            bgColor: '#FBF8F1', color: '#2F2724',
          } : undefined,
        }],
      });
    });
  },

  onMarker() { this.nav(); },

  nav() {
    const v = this.data.venue;
    wx.openLocation({
      latitude: v.latitude,
      longitude: v.longitude,
      name: v.name,
      address: v.address,
      scale: v.scale || 16,
    });
  },

  copy() {
    wx.setClipboardData({
      data: this.data.venue.address,
      success: () => wx.showToast({ title: '地址复制好了', icon: 'none' }),
    });
  },

  call() {
    wx.makePhoneCall({ phoneNumber: this.data.contact.phone });
  },
});
