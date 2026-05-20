const TrelloPowerUp = window.TrelloPowerUp;

export const initializePowerUp = () => {
  if (!TrelloPowerUp) {
    console.log("Running locally (no Trello)");
    return;
  }

  TrelloPowerUp.initialize({
    'board-buttons': function (t) {
      return [{
        text: 'Cardlytics',
        callback: function (t) {
          return t.modal({
            title: "Cardlytics",
            url: window.location.origin
          });
        }
      }];
    }
  });
};