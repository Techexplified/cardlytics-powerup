/* global TrelloPowerUp */

const key = 'eea918ac665b2e6ffcd2c13fb34decb4';

window.TrelloPowerUp.initialize({

  'board-buttons': function(t) {
  return [{
    text: 'Cardlytics',
    icon: {
      dark: 'https://cardlytics-powerup.vercel.app/logo-light.png',
      light: 'https://cardlytics-powerup.vercel.app/logo-dark.png'
    },
    callback: function(t) {
      return t.modal({
        title: 'Cardlytics',
        url: './index.html?mode=board',
        fullscreen: false,
        height: 600
      });
    }
  }];
},

  'list-actions': function(t) {
    return [{
      text: 'Cardlytics',
      callback: function(t) {
        return t.list('id').then(function(list) {
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

  'card-back-section': function(t) {
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

  'on-enable': function(t) {
    return t.modal({
      title: 'Welcome to Cardlytics 👋',
      url: './index.html?mode=onboarding',
      fullscreen: false,
      height: 500
    });
  },

  // ── Settings — must include disconnect option for Atlassian approval
  'show-settings': function(t) {
    return t.modal({
      title: 'Cardlytics Settings',
      url: './index.html?mode=settings',
      fullscreen: false,
      height: 400
    });
  },

  // ── Official auth check
  'authorization-status': function(t) {
  return t.getRestApi().isAuthorized().then(function(authorized) {
    return { authorized };
  });
},

'show-authorization': function(t) {
  return t.popup({
    title: 'Authorize Cardlytics',
    url: './index.html?mode=auth',
    height: 200,
  });
},

}, {
  appKey: key,     
  appName: 'Cardlytics'
});