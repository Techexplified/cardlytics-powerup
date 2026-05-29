/* global TrelloPowerUp */

window.TrelloPowerUp.initialize({

  // ── Board button ────────────────────────────────────────────────
  'board-buttons': function (t) {
    return [{
      text: 'Cardlytics',
      icon: {
        dark: 'https://cardlytics-powerup.vercel.app/logo-light.png',
        light: 'https://cardlytics-powerup.vercel.app/logo-dark.png'
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

  // ── List action ─────────────────────────────────────────────────
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

  // ── Card back section ───────────────────────────────────────────
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
  },

  // ── First install onboarding ────────────────────────────────────
  'on-enable': function (t) {
    return t.modal({
      title: 'Welcome to Cardlytics 👋',
      url: './index.html?mode=onboarding',
      fullscreen: false,
      height: 500
    });
  },

  // ── Settings panel ──────────────────────────────────────────────
  'show-settings': function (t) {
    return t.modal({
      title: 'Cardlytics Settings',
      url: './index.html?mode=settings',
      fullscreen: false,
      height: 400
    });
  },

  // ── Authorization status ────────────────────────────────────────
  'authorization-status': function (t) {
    return t.get('member', 'private', 'token').then(function (token) {
      return { authorized: !!token };
    });
  },

  // ── Show authorization ──────────────────────────────────────────
  'show-authorization': function (t) {
    return t.modal({
      title: 'Connect Your Trello Account',
      url: './index.html?mode=auth',
      fullscreen: false,
      height: 400
    });
  }

});