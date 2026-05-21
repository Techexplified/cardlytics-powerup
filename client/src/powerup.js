/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({

  // 🟦 BOARD BUTTON (Top bar)
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
          url: './index.html?mode=board', // board mode
          fullscreen: false
        });
      }
    }];
  },

  // 🟩 LIST ACTION (3 dots menu)
  'list-actions': function (t) {
  return [{
    text: 'Cardlytics',

    callback: async function (t) {
      const list = await t.list();   // ✅ get full object

        alert("List ID: " + list.id);    // 👈 debug

      return t.modal({
        title: 'Cardlytics',
        url: `./index.html?mode=list&listId=${list.id}`, // ✅ FIXED
        fullscreen: false
      });
    }
  }];
}

});