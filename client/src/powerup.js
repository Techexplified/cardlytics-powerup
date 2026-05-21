/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({
  'board-buttons': function (t, options) {
    return [{
      text: 'Cardlytics',
      
      icon: {
        dark: 'https://cardlytics-powerup.vercel.app/logo.png',
        light: 'https://cardlytics-powerup.vercel.app/logo.png'
      },

      callback: function (t) {
        return t.modal({
          title: 'Cardlytics',
          url: './index.html',
          fullscreen: false
        });
      }
    }];
  }
});