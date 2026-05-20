/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({
  'board-buttons': function (t, options) {
    return [{
      text: 'Cardlytics',
      callback: function (t) {
        return t.modal({
          title: 'Cardlytics',
          url: './index.html',
          fullscreen: false   // 👈 keeps it centered modal
        });
      }
    }];
  }
});