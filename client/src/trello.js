const TrelloPowerUp = window.TrelloPowerUp;

export const initializePowerUp = () => {
  if (!TrelloPowerUp) {
    console.error("TrelloPowerUp not loaded");
    return;
  }

  TrelloPowerUp.initialize({
    'board-buttons': function (t) {
      return [{
        text: 'Cardlytics',
        callback: function (t) {
          return t.popup({
            title: "Cardlytics",
            url: window.location.origin, // VERY IMPORTANT
            height: 600,
            width: 900
          });
        }
      }];
    }
  });
};