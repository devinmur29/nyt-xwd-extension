/*
This File defines functions that listen to post Message events from content scripts
*/
// Update the relevant fields with the new data.
var puzzleDate = "";

function getLocalStorageValue(key) {
    return new Promise(resolve => {
      chrome.storage.local.get(key, result => {
        console.log(result)
        if(key in result) {
            resolve(JSON.parse(result[key]));
        } else {
            resolve(null);
        }
      });
    });
  }

const sendMessageToContentScript = (tabId, message) => {
    return new Promise((resolve, reject)=>{
        chrome.tabs.sendMessage(tabId, message, (response)=>{
            resolve(response)
        });
    })
}

const checkIfPuzzleFinished = async () => {
    console.log("Checking if puzzle finished")
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    await sendMessageToContentScript(tab.id, {from: 'popup', subject: 'finCheck'});
    console.log(scriptResponse)
    return scriptResponse
}

const updateAllTimeStats = async (stats) => {
    let localStorageData = await getLocalStorageValue('allTimeStats');
    localStorageData = localStorageData || {};
    if(!localStorageData.fastest || stats.time < localStorageData.fastest.time) {
        localStorageData.fastest={
            date: stats.date,
            time: stats.time
        }
    }
    (!localStorageData.puzzlesSolved)?(localStorageData.puzzlesSolved=1):(localStorageData.puzzlesSolved+=1);
    if (!localStorageData.seenDict) {
        localStorageData.seenDict={};
    }
    for (let word of stats.answerObj.answerList) {
        if(word in localStorageData.seenDict) {
            localStorageData.seenDict[word].push(stats.date)
        } else {
            localStorageData.seenDict[word]=[stats.date]
        }
    }
    if (!localStorageData.missedDict) {
        localStorageData.missedDict={};
    }
    for (let word of stats.answerObj.missedList) {
        if(word in localStorageData.missedDict) {
            localStorageData.missedDict[word].push(stats.date)
        } else {
            localStorageData.missedDict[word]=[stats.date]
        }
    }
    await chrome.storage.local.set({ allTimeStats: JSON.stringify(localStorageData) });
    return localStorageData
}

const collectInfo = async () => {
    //1. Check if puzzle is done and that we haven't already collected stats for it
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let url = tab.url;
    let dateKey = getDateKeyFromUrl(url);
    let collected = await getLocalStorageValue('collected');
    collected = collected || [];
    if (!(collected.includes(dateKey))){
        let messageSent = await checkIfPuzzleFinished();
    } else {
        alert("Already collected stats for this puzzle")
    }
    //2. If puzzle not done, display message (You have to finish first!)
    //3. If puzzle done a. get date, b.get all time stats dict c. update fastest solve, puzzles solved, collect seenWords update, collect missedWords update,  delete unfin stats entry, refresh view
}

//Set collectInfo function for saving all time stats
document.getElementById('collect').onclick = collectInfo

const setDOMInfo = async (info) => {
    puzzleDate = info.puzzleDate;
    document.getElementById('puzzledate').textContent = info.puzzledate;
    document.getElementById('solved').textContent = info.filled;
    document.getElementById('progress').textContent = String(Math.round((info.filled/info.clueCount)*100)) + "%";
    document.getElementById('count').textContent=String(info.clueCount);
    console.log(info)
    let recordSplit = await getRecordSplit(info.time);
    document.getElementById('split').textContent= recordSplit;
    let stats = await getLocalStorageValue('allTimeStats');
    console.log(stats);
    updateAllTimeStatsView(stats);
  };

  //Return Date() object for a NYT Time String
const processTimeString = (timeStr) =>{
    let hrsminsecs = timeStr.split(':');
    console.log(hrsminsecs)
    let procDate = new Date();
    procDate.setHours(0, 0, 0);
    switch (hrsminsecs.length) {
        case 3:
            procDate.setHours(parseInt(hrsminsecs[0]),parseInt(hrsminsecs[1]),parseInt(hrsminsecs[2]))
        case 2:
            procDate.setHours(0,parseInt(hrsminsecs[0]),parseInt(hrsminsecs[1]))
    }
    return procDate
}

//Return String representing split between current time and record time
const getRecordSplit = async (time) => {
    let record;
    let result = await getLocalStorageValue('allTimeStats');
    if (result) {
        record = result.fastest.time;
    } else {
        record = "59:59"
    }
    let currTime = processTimeString(time);
    let recordTime = processTimeString(record);
    let splitTimeString = getTimeDifference(currTime, recordTime);
    return splitTimeString
}

//Format date to be hh:mm:ss
function formatDateParts(number) {
    return number < 10 ? '0' + number : number;
}

//Do math to get time difference between recordTime and Current time, and return the string
function getTimeDifference(startDate, endDate) {
    const timeDifference = endDate - startDate;
    const hours = Math.floor(Math.abs(timeDifference) / (1000 * 60 * 60));
    const minutes = Math.floor((Math.abs(timeDifference) % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((Math.abs(timeDifference) % (1000 * 60)) / 1000);
    let splitStr = `${formatDateParts(hours)}:${formatDateParts(minutes)}:${formatDateParts(seconds)}`;
    let result;
    (timeDifference > 0)? result = splitStr: result = `Missed Record By: ${splitStr}`;
    return result
}
const getDateKeyFromUrl= (url) =>{
    let dateKey = ""
    if (url!==""){
        let parts = url.split('/');
        dateKey = parts.slice(-3).join('/');
    }
    return dateKey
}

const updateAllTimeStatsView = (stats) => {
    if (stats) {
        document.getElementById('record').textContent= stats.fastest.time + ", on " + stats.fastest.date;
        document.getElementById('puzzlessolved').textContent=stats.puzzlesSolved;
        createWordTable('#seenwords',stats.seenDict)
        createWordTable('#missedwords',stats.missedDict)
        statsDiv = document.getElementById('allTimeStats');
        statsDiv.style.visibility = 'visible';
        nostatsDiv = document.getElementById('noStats');
        nostatsDiv.style.display = 'none';
    } 
}

const createWordTable = (parent, wordDict)=> {
    const divElement = document.querySelector(parent);

    // Get an array of word-frequency pairs sorted by frequency in descending order
    const wordFrequencyPairs = Object.entries(wordDict).map(([word, dates]) => ({ word, frequency: dates.length }));
    wordFrequencyPairs.sort((a, b) => b.frequency - a.frequency);

    // Take the top 5 most commonly seen words
    const topWords = wordFrequencyPairs.slice(0, 5);

    // Create an HTML table
    const table = document.createElement("table");
    table.classList.add('table','table-bordered')
    const tableBody = document.createElement("tbody");

    // Create the table rows for the top words
    topWords.forEach(({ word, frequency }) => {
    const row = tableBody.insertRow();
    const cell1 = row.insertCell(0);
    const cell2 = row.insertCell(1);
    const cell3 = row.insertCell(2);
    cell1.innerHTML = word;
    cell2.innerHTML = frequency
    cell3.innerHTML = wordDict[word].join(", "); // Join dates with commas
    });

    // Append the table to the div element
    table.appendChild(tableBody);
    divElement.appendChild(table);

    // Add a table header
    const tableHeader = table.createTHead();
    const headerRow = tableHeader.insertRow();
    const headerCell1 = headerRow.insertCell(0);
    const headerCell2 = headerRow.insertCell(1);
    const headerCell3 = headerRow.insertCell(2);
    headerCell1.innerHTML = "Words:";
    headerCell2.innerHTML = "Count:";
    headerCell3.innerHTML = "Dates: "
}
  
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse)=>{
    if (msg.from === 'contentscript' && msg.subject==='statsInfo') {
        let stats = msg.data;
        if (!stats.puzzleFinished) {
            window.alert("You've gotta finish the puzzle first!! You can do it!!")
        } else {
            let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            let url = tab.url;
            stats.date = getDateKeyFromUrl(url);
            let updatedStats = await updateAllTimeStats(stats);
            let collected = await getLocalStorageValue('collected');
            collected = collected || [];
            collected.push(stats.date)
            await chrome.storage.local.set({collected: JSON.stringify(collected)});
            await updateAllTimeStatsView(updatedStats);
        }
    }
})
// Once the DOM is ready...
window.addEventListener('DOMContentLoaded', () => {
    // ...query for the active tab...
    console.log("Sending message")
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tabs => {
        // ...and send a request for the DOM info...
        chrome.tabs.sendMessage(
            tabs[0].id,
            {from: 'popup', subject: 'DOMInfo'}).then((domInfo)=>{
                setDOMInfo(domInfo);
            });
    });
});