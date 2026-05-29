/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({

  'board-buttons': function (t) {
    return [{
      text: 'Cardlytics',
      icon: {
        dark: 'https://cardlytics-powerup.vercel.app/logo.png',
        light: 'https://cardlytics-powerup.vercel.app/logo.png'
      },
      callback: function (t) {
        return t.modal({
          title: 'Cardlytics',
          url: './index.html?mode=board',
          fullscreen: false,
          height: 600
        });
      }
    }];
  },

  'list-actions': function (t) {
    return [{
      text: 'Cardlytics',
      callback: function (t) {
        return t.list('id').then(function (list) {
          return t.modal({
            title: 'Cardlytics',
            url: `./index.html?mode=list&listId=${list.id}`,
            fullscreen: false,
            height: 600
          });
        });
      }
    }];
  },

  'card-back-section': function (t) {
    return {
      title: 'Cardlytics',
      icon: 'https://cardlytics-powerup.vercel.app/logo.png',
      content: {
        type: 'iframe',
        url: t.signUrl('./index.html?view=card'),
        height: 44
      }
    };
  }

});