// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clueRevealed') {
    const localStorageData = getLocalStorageData(message.date);
    localStorageData[message.date]["cluesRevealed"].push(message.clue);
    updateLocal(localStorageData);
  }
});

// Get or create the puzzle date data in localStorage
function getLocalStorageData(currentDate) {
  const localStorageData = JSON.parse(localStorage.getItem('unfinStats')) || {};
  if (!localStorageData[currentDate]) {
    localStorageData[currentDate] = { cluesRevealed: [] };
  }
  return localStorageData;
}

// Update the puzzle date data in localStorage
function updateLocal(localStorageData) {
  localStorage.setItem('unfinStats', JSON.stringify(localStorageData));
}
/*
This dict should be gone when the puzzle gets completed
{unfinStats: {
    {date,
    cluesRevealed: []
    }
    
}}
This dict should always exist
{FastestSolve:{
    Date:
    Time:
    Link:
},
PuzzlesSolved:Count,
SeenWords:{
    word: Count
}
MissedWords:{
    word:Count
}}
*/