# OneDay Tower

The game is `oneday-tower.html`. The server serves it at **/tower**.

Controls: tap the left or right side on a phone. On a computer, the arrow keys (or A and D) steer, Space (or Up, or W) jumps, and Space or Enter starts a run.

## Shared scoreboard (Firebase)

Scores sync live between every phone and computer once Firebase is connected. Without it, each device keeps its own scores.

1. Go to https://console.firebase.google.com and create a project (Google Analytics is not needed).
2. In the project, open **Build > Firestore Database**, click **Create database**, pick a location, and start in **production mode**.
3. Open the **Rules** tab, replace everything with the rules below, and click **Publish**.
4. Open **Project settings** (the gear icon), scroll to **Your apps**, click the **</>** (web) icon, give it a nickname, and register it. Hosting is not needed.
5. Copy the `firebaseConfig` object it shows and paste it into `public/tower-firebase.js` in place of `null`.

### Firestore rules

These let anyone read the board, let a name's score only go up, and reject scores that are malformed or impossibly large.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{id} {
      function valid() {
        let d = request.resource.data;
        return d.keys().hasOnly(['name', 'score', 'floor', 'diff', 'at'])
          && d.name is string && d.name.size() > 0 && d.name.size() <= 16
          && d.score is int && d.score > 0 && d.score < 2000000
          && d.floor is int && d.floor >= 0 && d.floor <= 200000
          && d.diff in ['easy', 'normal', 'hard']
          && d.at is int;
      }
      allow read: if true;
      allow create: if valid();
      allow update: if valid() && request.resource.data.score > resource.data.score;
      allow delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
