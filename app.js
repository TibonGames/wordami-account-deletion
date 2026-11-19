// Wordami – strona usuwania konta. Bez sekretów: wszystkie wartości poniżej są publiczne (są też w APK).
// Przebieg: Google (token Gier Play, zakres games_lite) -> ID gracza Gier Play -> konto Wordami w PlayFab
// -> CloudScript WebRequestAccountDeletion (serwer SAM weryfikuje token w Google i powiązanie konta) -> pętla
// WebContinueAccountDeletion z biletem aż do "completed". Opis: Docs/AI/ACCOUNT_DELETION.md §6.
"use strict";

const CONFIG = {
  titleId: "497B9",                                                                          // PlayFab Title ID
  googleClientId: "582477122326-ev0avkknv4qfm7fph79str5h3ajmbpah.apps.googleusercontent.com", // klient OAuth „Web” (Wordami Game Server)
  gpgsApplicationId: "582477122326",                                                         // ID aplikacji Gier Play
  portalCustomId: "wordami-web-account-deletion-portal",                                     // = WEB_PORTAL_CUSTOM_ID w CloudScript
  confirmPhrase: "DELETE_MY_ACCOUNT",                                                        // = ACCOUNT_DELETION_CONFIRM w CloudScript
  contactEmail: "contact.merrymothgames@gmail.com"                                           // publiczny adres kontaktowy dewelopera
};

const GAMES_SCOPE = "https://www.googleapis.com/auth/games_lite";
const MAX_CONTINUE_CALLS = 80;

const TEXT = {
  pl: {
    signinTitle: "Krok 1: potwierdź, że to Twoje konto",
    signinText: "Zaloguj się kontem Google, którego używasz w Grach Google Play na telefonie z Wordami. Wordami nie ma własnych haseł – konto gry jest powiązane z Twoim profilem Gier Play.",
    signinPrivacy: "Google przekaże nam tylko identyfikator Twojego profilu Gier Play w Wordami (bez hasła i adresu e-mail). Token służy wyłącznie do jednorazowej weryfikacji i jest unieważniany po zakończeniu.",
    signinButton: "Zaloguj się przez Google",
    confirmTitle: "Krok 2: potwierdź usunięcie",
    accountFound: "Znaleźliśmy konto Wordami powiązane z profilem Gier Play {name}.",
    accountFoundNoName: "Znaleźliśmy konto Wordami powiązane z Twoim profilem Gier Play.",
    confirmWarning: "Tej operacji nie da się cofnąć.",
    confirmWarningText: "Konto, postęp, znajomi i wszystkie dane opisane niżej zostaną trwale usunięte. Odzyskanie konta nie będzie możliwe.",
    confirmCheckbox: "Rozumiem, że usunięcie konta jest trwałe i nieodwracalne.",
    confirmTypeLabel: "Aby potwierdzić, wpisz słowo USUŃ:",
    confirmButton: "Usuń konto na zawsze",
    cancelButton: "Anuluj",
    progressTitle: "Usuwanie konta…",
    progressStep: "Etap {step} z {count}",
    progressKeepOpen: "Nie zamykaj tej strony do zakończenia. Jeśli połączenie zostanie przerwane, usuwanie jest już rozpoczęte – wróć na stronę i powtórz kroki, aby je dokończyć.",
    doneTitle: "Konto zostało usunięte",
    doneText: "Twoje konto Wordami i powiązane dane zostały usunięte. Ostatni etap (skasowanie konta w systemach Microsoft PlayFab) odbywa się automatycznie. Jeśli masz grę na telefonie, odinstaluj ją lub wyczyść dane aplikacji, aby usunąć też dane z urządzenia.",
    retryButton: "Spróbuj ponownie",
    restartButton: "Zacznij od nowa",
    errNoGoogleScript: "Nie udało się wczytać logowania Google. Sprawdź połączenie lub blokery treści i odśwież stronę.",
    errGoogleDenied: "Logowanie Google zostało przerwane albo nie udzielono dostępu do Gier Play. Bez tego nie możemy potwierdzić, że konto należy do Ciebie.",
    errNoGpgsProfile: "To konto Google nie ma profilu Gier Play w Wordami. Upewnij się, że logujesz się tym samym kontem Google, którego używasz w grze.",
    errNoAccount: "Nie znaleźliśmy konta Wordami powiązanego z tym profilem Gier Play. Konto mogło zostać już usunięte albo grałeś(-aś) innym kontem Google.",
    errVerification: "Serwer nie potwierdził Twojego logowania Google. Zaloguj się ponownie.",
    errMismatch: "Profil Gier Play nie pasuje do konta Wordami. Zaloguj się ponownie tym samym kontem Google, którego używasz w grze.",
    errBlocked: "Usuwanie konta zostało rozpoczęte, ale serwer nie może go teraz dokończyć. Konto jest zablokowane do czasu usunięcia, a proces zostanie dokończony automatycznie lub przy kolejnej próbie. Spróbuj ponownie później{contact}.",
    errInterrupted: "Usuwanie konta zostało rozpoczęte, ale połączenie zostało przerwane. Spróbuj ponownie – usuwanie zostanie dokończone.",
    errNetwork: "Nie udało się połączyć z serwerem. Sprawdź połączenie i spróbuj ponownie.",
    errUnknown: "Wystąpił nieoczekiwany błąd ({code}). Spróbuj ponownie{contact}.",
    contactSuffix: " albo napisz do nas: {email}"
  },
  en: {
    signinTitle: "Step 1: confirm it is your account",
    signinText: "Sign in with the Google Account you use for Google Play Games on the phone where you play Wordami. Wordami has no passwords of its own – your game account is linked to your Play Games profile.",
    signinPrivacy: "Google only shares your Play Games profile identifier for Wordami with us (no password or email address). The token is used only for a one-time verification and is revoked afterwards.",
    signinButton: "Sign in with Google",
    confirmTitle: "Step 2: confirm deletion",
    accountFound: "We found a Wordami account linked to the Play Games profile {name}.",
    accountFoundNoName: "We found a Wordami account linked to your Play Games profile.",
    confirmWarning: "This cannot be undone.",
    confirmWarningText: "Your account, progress, friends and all data described below will be permanently deleted. The account cannot be recovered.",
    confirmCheckbox: "I understand that deleting my account is permanent and irreversible.",
    confirmTypeLabel: "To confirm, type the word DELETE:",
    confirmButton: "Delete account forever",
    cancelButton: "Cancel",
    progressTitle: "Deleting account…",
    progressStep: "Step {step} of {count}",
    progressKeepOpen: "Keep this page open until it finishes. If the connection drops, deletion has already started – come back and repeat the steps to finish it.",
    doneTitle: "Your account has been deleted",
    doneText: "Your Wordami account and associated data have been deleted. The last stage (removal from Microsoft PlayFab systems) runs automatically. If the game is still on your phone, uninstall it or clear the app's data to remove data from the device too.",
    retryButton: "Try again",
    restartButton: "Start over",
    errNoGoogleScript: "Could not load Google sign-in. Check your connection or content blockers and reload the page.",
    errGoogleDenied: "Google sign-in was cancelled or access to Play Games was not granted. Without it we cannot confirm that the account is yours.",
    errNoGpgsProfile: "This Google Account has no Play Games profile for Wordami. Make sure you sign in with the same Google Account you use in the game.",
    errNoAccount: "We could not find a Wordami account linked to this Play Games profile. It may already be deleted, or you played with a different Google Account.",
    errVerification: "The server could not verify your Google sign-in. Please sign in again.",
    errMismatch: "The Play Games profile does not match the Wordami account. Sign in again with the Google Account you use in the game.",
    errBlocked: "Account deletion has started, but the server cannot finish it right now. The account is locked until it is deleted, and the process will be completed automatically or on your next attempt. Please try again later{contact}.",
    errInterrupted: "Account deletion has started, but the connection was interrupted. Try again – deletion will be completed.",
    errNetwork: "Could not reach the server. Check your connection and try again.",
    errUnknown: "An unexpected error occurred ({code}). Please try again{contact}.",
    contactSuffix: " or contact us: {email}"
  }
};

// ------------------------------------------------------------------ język

let lang = (navigator.language || "").toLowerCase().startsWith("pl") ? "pl" : "en";

function t(key, vars) {
  let s = (TEXT[lang] && TEXT[lang][key]) || TEXT.en[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.body.classList.add("js");
  document.querySelectorAll("[data-lang]").forEach(el => el.classList.toggle("active-lang", el.getAttribute("data-lang") === lang));
  document.querySelectorAll("[data-set-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute("data-set-lang") === lang)));
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll(".contact-link").forEach(a => {
    if (CONFIG.contactEmail) { a.textContent = CONFIG.contactEmail; a.href = "mailto:" + CONFIG.contactEmail; }
    else { a.textContent = "—"; a.removeAttribute("href"); }
  });
  if (state.render) state.render();
}

// ------------------------------------------------------------------ stan

const state = {
  accessToken: null,
  gpgsName: "",
  playFabId: null,
  sessionTicket: null,
  ticket: null,
  started: false,
  render: null,
  retry: null
};

function show(stepId) {
  for (const id of ["step-signin", "step-confirm", "step-progress", "step-done", "step-message"])
    document.getElementById(id).hidden = id !== stepId;
}

function showMessage(text, retry) {
  state.retry = retry || null;
  state.render = () => { document.getElementById("message-text").textContent = typeof text === "function" ? text() : text; };
  state.render();
  document.getElementById("btn-retry").hidden = !retry;
  show("step-message");
}

function contact() {
  return CONFIG.contactEmail ? t("contactSuffix", { email: CONFIG.contactEmail }) : "";
}

// ------------------------------------------------------------------ Google (token Gier Play)

let tokenClient = null;

function waitForGoogle(timeoutMs) {
  return new Promise(resolve => {
    const start = Date.now();
    (function poll() {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(poll, 100);
    })();
  });
}

async function signIn() {
  if (!(await waitForGoogle(8000))) return showMessage(() => t("errNoGoogleScript"), signIn);

  tokenClient = tokenClient || google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: GAMES_SCOPE,
    prompt: "select_account",
    callback: onGoogleToken,
    error_callback: () => showMessage(() => t("errGoogleDenied"), signIn)
  });
  tokenClient.requestAccessToken();
}

async function onGoogleToken(response) {
  if (!response || response.error || !response.access_token ||
      !google.accounts.oauth2.hasGrantedAllScopes(response, GAMES_SCOPE)) {
    return showMessage(() => t("errGoogleDenied"), signIn);
  }
  state.accessToken = response.access_token;

  try {
    // ID gracza Gier Play dla Wordami (Google sprawdza, że token jest dla naszej gry). Serwer zweryfikuje to samo ponownie.
    const verify = await googleGet(`https://games.googleapis.com/games/v1/applications/${CONFIG.gpgsApplicationId}/verify`);
    if (!verify || !verify.player_id) return showMessage(() => t("errNoGpgsProfile"), restart);

    state.gpgsName = "";
    try {
      const me = await googleGet("https://games.googleapis.com/games/v1/players/me");
      if (me && me.displayName) state.gpgsName = String(me.displayName);
    } catch (e) { /* nazwa tylko do wyświetlenia */ }

    await playFabLoginPortal();
    const lookup = await playFabCall("Client/GetPlayFabIDsFromGooglePlayGamesPlayerIDs", { GooglePlayGamesPlayerIDs: [String(verify.player_id)] });
    const pair = (lookup.Data || []).find(p => p.PlayFabId);
    if (!pair) return showMessage(() => t("errNoAccount"), restart);
    state.playFabId = pair.PlayFabId;
    showConfirm();
  } catch (e) {
    console.warn(e);
    showMessage(() => t("errNetwork"), () => onGoogleToken(response));
  }
}

async function googleGet(url) {
  const res = await fetch(url, { headers: { Authorization: "Bearer " + state.accessToken } });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error("Google HTTP " + res.status);
  return res.json();
}

function revokeGoogleToken() {
  if (state.accessToken && window.google && google.accounts && google.accounts.oauth2) {
    try { google.accounts.oauth2.revoke(state.accessToken, () => {}); } catch (e) { /* bez znaczenia */ }
  }
  state.accessToken = null;
}

// ------------------------------------------------------------------ PlayFab (REST Client API)

async function playFabLoginPortal() {
  if (state.sessionTicket) return;
  const data = await playFabCall("Client/LoginWithCustomID", { TitleId: CONFIG.titleId, CustomId: CONFIG.portalCustomId, CreateAccount: true }, true);
  state.sessionTicket = data.SessionTicket;
}

async function playFabCall(path, body, anonymous) {
  const headers = { "Content-Type": "application/json" };
  if (!anonymous) headers["X-Authorization"] = state.sessionTicket;
  const res = await fetch(`https://${CONFIG.titleId.toLowerCase()}.playfabapi.com/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.code !== 200) {
    const err = new Error("PlayFab " + path + ": " + (json && (json.error || json.errorMessage) || res.status));
    err.playFabError = json && json.error;
    throw err;
  }
  return json.data;
}

async function cloudScript(functionName, args) {
  const data = await playFabCall("Client/ExecuteCloudScript", { FunctionName: functionName, FunctionParameter: args, GeneratePlayStreamEvent: false });
  if (data.Error) {
    const err = new Error("CloudScript " + data.Error.Error + ": " + data.Error.Message);
    err.cloudScript = true;
    throw err;
  }
  return data.FunctionResult || {};
}

// ------------------------------------------------------------------ potwierdzenie i usuwanie

function isConfirmWord(text) {
  const n = String(text || "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return n === "USUN" || n === "DELETE";
}

function showConfirm() {
  state.render = () => {
    document.getElementById("account-found").textContent = state.gpgsName
      ? t("accountFound", { name: "„" + state.gpgsName + "”" })
      : t("accountFoundNoName");
  };
  state.render();
  document.getElementById("chk-understand").checked = false;
  document.getElementById("confirm-word").value = "";
  refreshDeleteButton();
  show("step-confirm");
}

function refreshDeleteButton() {
  document.getElementById("btn-delete").disabled =
    !(document.getElementById("chk-understand").checked && isConfirmWord(document.getElementById("confirm-word").value));
}

function setProgress(response) {
  const count = response && response.stepCount || 0;
  const step = response && typeof response.stepIndex === "number" ? response.stepIndex + 1 : 0;
  state.render = () => {
    document.getElementById("progress-text").textContent = count ? t("progressStep", { step, count }) : "…";
  };
  state.render();
  document.getElementById("progress-bar").style.width = count ? Math.round(100 * step / count) + "%" : "4%";
  show("step-progress");
}

async function startDeletion() {
  setProgress(null);
  try {
    // Serwer weryfikuje token Google (applications.verify) i powiązanie konta z TYM graczem Gier Play.
    const r = await cloudScript("WebRequestAccountDeletion", {
      googleAccessToken: state.accessToken, playFabId: state.playFabId, confirm: CONFIG.confirmPhrase
    });
    if (r.ticket) state.ticket = r.ticket;
    await handleResponse(r);
  } catch (e) {
    console.warn(e);
    showMessage(() => t(state.started ? "errInterrupted" : "errNetwork"), state.started ? continueDeletion : startDeletion);
  }
}

async function continueDeletion() {
  setProgress(null);
  try {
    const r = await cloudScript("WebContinueAccountDeletion", { playFabId: state.playFabId, ticket: state.ticket });
    await handleResponse(r);
  } catch (e) {
    console.warn(e);
    showMessage(() => t("errInterrupted"), continueDeletion);
  }
}

async function handleResponse(r) {
  for (let calls = 0; calls < MAX_CONTINUE_CALLS; calls++) {
    switch (r.code) {
      case "completed":
      case "account_gone":
        return finish();
      case "in_progress":
        state.started = true;
        setProgress(r);
        r = await cloudScript("WebContinueAccountDeletion", { playFabId: state.playFabId, ticket: state.ticket });
        continue;
      case "retry":
        state.started = true;
        await new Promise(res => setTimeout(res, 1500));
        r = await cloudScript("WebContinueAccountDeletion", { playFabId: state.playFabId, ticket: state.ticket });
        continue;
      case "blocked":
        state.started = true;
        return showMessage(() => t("errBlocked", { contact: contact() }), continueDeletion);
      case "google_verification_failed":
        revokeGoogleToken();
        return showMessage(() => t("errVerification"), restart);
      case "account_mismatch":
        revokeGoogleToken();
        return showMessage(() => t("errMismatch"), restart);
      case "account_not_found":
        return showMessage(() => t("errNoAccount"), restart);
      default:
        return showMessage(() => t("errUnknown", { code: r.code || "?", contact: contact() }), state.started ? continueDeletion : restart);
    }
  }
  showMessage(() => t("errInterrupted"), continueDeletion);
}

function finish() {
  revokeGoogleToken();
  state.render = null;
  show("step-done");
}

function restart() {
  revokeGoogleToken();
  state.playFabId = null;
  state.ticket = null;
  state.started = false;
  state.render = null;
  show("step-signin");
}

// ------------------------------------------------------------------ start

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-set-lang]").forEach(b => b.addEventListener("click", () => { lang = b.getAttribute("data-set-lang"); applyLanguage(); }));
  document.getElementById("btn-signin").addEventListener("click", signIn);
  document.getElementById("chk-understand").addEventListener("change", refreshDeleteButton);
  document.getElementById("confirm-word").addEventListener("input", refreshDeleteButton);
  document.getElementById("btn-delete").addEventListener("click", () => { if (!document.getElementById("btn-delete").disabled) startDeletion(); });
  document.getElementById("btn-cancel").addEventListener("click", restart);
  document.getElementById("btn-retry").addEventListener("click", () => { if (state.retry) state.retry(); });
  document.getElementById("btn-restart").addEventListener("click", restart);
  applyLanguage();
  show("step-signin");
});
