console.log("In Content Script 2")
//window.postMessage({type : "XWDDATE", text : currDate}, "*");

// Listen for messages from the popup.
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  // First, validate the message's structure.
  if ((msg.from === 'popup') && (msg.subject === 'DOMInfo')) {
    // Collect the necessary data. 
    console.log("received msg from popup")
    var domInfo = {
      puzzledate: document.querySelector(".xwd__details--date").innerText,
      filled: document.querySelectorAll(".xwd__clue--filled").length,
      clueCount: document.querySelectorAll(".xwd__clue--li").length,
      time: document.querySelectorAll(".timer-count")[0].innerText
    };
    // Directly respond to the sender (popup), 
    // through the specified callback.
    console.log(domInfo);
    sendResponse(domInfo);
    return true;
  } else if ((msg.from === 'popup') && (msg.subject === 'finCheck')) {
    sendResponse("received Message");
    const revealElement = document.querySelector('button[type="button"][aria-label="reveal"]');
    let puzzleFinished = revealElement == null;
    let answerObj = {};
    if (puzzleFinished) {
      answerObj = await getXwdAnswers();
    }
    var resp = {
      puzzleFinished,
      answerObj,
      time: document.querySelectorAll(".timer-count")[0].innerText
    }
    console.log(resp)
    chrome.runtime.sendMessage({
      from: "contentscript",
      subject: "statsInfo",
      data: resp
    })
  }
});


const waitForSelectedClass = (clueNode, callback) => {
  //Create Mutation Observer Objects for Clues to listen for --filled tag
  const mutationConfig = { attributes: true };
  const mutationCallback = (mutationList, observer) => {
    mutationList.forEach(mutation => {
      if (mutation.attributeName === 'class' && mutation.target.className.includes("xwd__clue--selected")) {
        callback()
      }
    });
  }
  const observer = new MutationObserver(mutationCallback);
  observer.observe(clueNode, mutationConfig)
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*Collect all of the crossword answers from the clue list*/
const getXwdAnswers = async () => {
  //get all of the clues
  const clueNodes = document.querySelectorAll(".xwd__clue--li");
  //create answerList and missedList
  const answerList=[];
  const missedList=[];
  const addAnswerToAnswerList = () => {
    console.log("called add answer to list")
    let revealedWord = getRevealedFromCurrSelected();
    answerList.push(revealedWord.guessedWord)
    if (revealedWord.assistUsed) {
      missedList.push(revealedWord.guessedWord)
    }
  }
  //for each clue, click it, get the answer from the highlighted cells
  for (let clueNode of clueNodes) {
    waitForSelectedClass(clueNode, addAnswerToAnswerList);
    clueNode.click();
    await sleep(50);
  }
  return {answerList, missedList}
}


/*Get the guess from the currently selected clue in clue list*/
const getRevealedFromCurrSelected = () => {
  let letterCells = document.querySelectorAll(".xwd__cell--highlighted.xwd__cell--cell.xwd__cell--nested");
  console.log(letterCells)
  assistUsed = xwdAssistanceUsed(letterCells);
  console.log(assistUsed)
  let guessedWord = '';
  for (let node of letterCells) {
    let letter = node.parentNode.textContent.slice(-1);
    guessedWord += letter;
  }
  return { assistUsed, guessedWord }
}

const xwdAssistanceUsed = (cellList) => {
  let cellArray = Array.from(cellList);
  const assistUsed = cellArray.some((elem) => {
    return elem.parentNode.querySelector('use.xwd__assistance--revealed') !== null;
  });
  return assistUsed
}

