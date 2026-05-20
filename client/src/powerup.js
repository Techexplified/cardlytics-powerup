/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({
  'board-buttons': function (t, options) {
    return [{
      text: 'Cardlytics',
      callback: function (t) {
        return t.popup({
          title: 'Cardlytics',
          url: './index.html',
          height: 600,
          width: 500
        });
      }
    }];
  }
});