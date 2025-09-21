// app.js

let currentRoomId = null;
let currentPlayerName = null;
let isHost = false;

// ELEMENTI DOM
const viewHome = document.getElementById("viewHome");
const viewRoom = document.getElementById("viewRoom");
const viewRoles = document.getElementById("viewRoles");
const viewRoleCard = document.getElementById("viewRoleCard");

const btnCreate = document.getElementById("btnCreate");
const btnJoin = document.getElementById("btnJoin");
const btnStartGame = document.getElementById("btnStartGame");
const playerList = document.getElementById("playerList");

// --- FUNZIONE: cambio schermata ---
function showView(view) {
  [viewHome, viewRoom, viewRoles, viewRoleCard].forEach(v =>
    v.classList.add("hidden")
  );
  view.classList.remove("hidden");
}

// --- CREA STANZA ---
btnCreate.addEventListener("click", async () => {
  const roomName = document.getElementById("inputRoomNameCreate").value.trim();
  const playerName = document.getElementById("inputNameCreate").value.trim();

  if (!roomName || !playerName) {
    return alert("Inserisci sia il nome della stanza che il tuo nome!");
  }

  try {
    const roomRef = await db.collection("rooms").add({
      createdAt: Date.now(),
      roomName: roomName,
      players: [playerName] // 👈 host con il suo vero nome
    });

    currentRoomId = roomRef.id;
    currentPlayerName = playerName;
    isHost = true;

    document.getElementById(
      "roomTitle"
    ).innerText = `Stanza: ${roomName} (ID: ${currentRoomId})`;

    showView(viewRoom);
    subscribeToRoom(currentRoomId);
  } catch (err) {
    console.error("Errore creazione stanza:", err);
    alert("Errore durante la creazione della stanza");
  }
});

// --- ENTRA IN STANZA ---
btnJoin.addEventListener("click", async () => {
  const name = document.getElementById("inputNameJoin").value.trim();
  const roomId = document.getElementById("inputRoomId").value.trim();

  if (!name || !roomId) {
    return alert("Inserisci nome e ID stanza!");
  }

  try {
    const roomRef = db.collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      return alert("Stanza non trovata");
    }

    await roomRef.update({
      players: firebase.firestore.FieldValue.arrayUnion(name)
    });

    currentRoomId = roomId;
    currentPlayerName = name;

    document.getElementById("roomTitle").innerText = `Stanza: ${roomId}`;
    showView(viewRoom);

    subscribeToRoom(roomId);
  } catch (err) {
    console.error("Errore ingresso stanza:", err);
    alert("Impossibile entrare nella stanza");
  }
});

// --- ASCOLTA I GIOCATORI IN STANZA ---
function subscribeToRoom(roomId) {
  db.collection("rooms").doc(roomId).onSnapshot(doc => {
    const data = doc.data();
    if (!data) return;

    playerList.innerHTML = "";
    data.players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      playerList.appendChild(li);
    });
  });
}

// --- INIZIA PARTITA (solo host) ---
btnStartGame.addEventListener("click", () => {
  if (!isHost) return alert("Solo l'host può iniziare la partita");
  showView(viewRoles);
});

// --- RUOLI DISPONIBILI ---
const roles = [
  { name: "Lupo", description: "Il lupo elimina un giocatore a turno." },
  { name: "Contadino", description: "Un semplice contadino senza poteri." },
  { name: "Veggente", description: "Ogni notte può scoprire il ruolo di un giocatore." },
  { name: "Guardia", description: "Può proteggere un giocatore per turno." }
];

// --- MOSTRA LISTA RUOLI ---
function showRolesList() {
  const rolesList = document.getElementById("rolesList");
  rolesList.innerHTML = "";

  roles.forEach(role => {
    const div = document.createElement("div");
    div.classList.add("role-card");
    div.innerHTML = `<strong>${role.name}</strong><p>${role.description}</p>`;
    rolesList.appendChild(div);
  });
}

// --- ASSEGNA RUOLI AI GIOCATORI ---
document.getElementById("btnAssignRoles").addEventListener("click", () => {
  db.collection("rooms").doc(currentRoomId).update({
    assignedRoles: shuffleArray(roles).slice(0, playerList.childNodes.length)
  });
  showView(viewRoleCard);
});

// --- MOSTRA CARTA RUOLO (esempio semplificato) ---
function showMyRole(role) {
  document.getElementById("roleName").innerText = role.name;
  document.getElementById("roleDescription").innerText = role.description;
  showView(viewRoleCard);
}

// --- UTILITY: mescola array ---
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}