const app = getApp();

Page({
  data: { venue: {}, contact: {}, routes: [], markers: [], polyline: [] },

  onShow() {
    app.ready((c) => {
      const v = c.venue;
      this.setData({
        venue: v,
        contact: c.contact,
        routes: c.routes.map((r) => ({ ...r, iconPath: `/images/ico-${r.icon || 'info'}.png` })),
        markers: [{
          id: 1,
          latitude: v.latitude,
          longitude: v.longitude,
          title: v.name,
          width: 36,
          height: 36,
          callout: {
            content: v.name + ' · ' + v.hall,
            display: 'ALWAYS', padding: 8, borderRadius: 8,
            bgColor: '#FFFDFA', color: '#4A3A31',
          },
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
