// EMQX Cloud: ブラウザに認証情報をハードコードしない
const EMQX_WSS_URL = "wss://i13aaaec.ala.asia-southeast1.emqxsl.com:8084/mqtt";
let client = null;
// A unique response topic for this browser tab (no credentials in the URL).
const HISTORY_CLIENT_ID = "web" + crypto.randomUUID().replace(/-/g, "").slice(0, 18);
const HISTORY_RESPONSE_TOPIC = "room/history/response/" + HISTORY_CLIENT_ID;
let historyRequestId = null;
let historyExpectedSeq = 0;
let historyHadGap = false;
let historyRows = [];
let historyChart = null;
let historyTimer = null;


function setMqttStatus(message, connected = false) {
    const el = document.getElementById("mqttStatus");
    el.textContent = message;
    el.className = connected ? "statusOn" : "statusOff";
}

// 標準のフォーム送信で、ブラウザのパスワード保存・自動入力を認識しやすくする。
// HTMLに認証情報を埋め込んだり、localStorageへ保存したりはしない。
const mqttLoginForm = document.getElementById("mqttLoginForm");
mqttLoginForm.addEventListener("submit", event => {
    event.preventDefault();  // GitHub Pagesに認証情報を送信しない
    connectToEmqx();
});
document.getElementById("mqttConnectBtn").disabled = false;

function connectToEmqx() {
    const username = document.getElementById("mqttUsername").value.trim();
    const password = document.getElementById("mqttPassword").value;
    if (!username || !password) {
        setMqttStatus("● ユーザー名とパスワードが必要です");
        return;
    }
    if (client) client.end(true);
    setMqttStatus("● Connecting...");
    client = mqtt.connect(EMQX_WSS_URL, {
        clientId: "room-web-" + crypto.randomUUID(),
        username,
        password,
        connectTimeout: 10000,
        reconnectPeriod: 3000,
        clean: true
    });
    // 接続成功まではフォームを維持する。直ちにパスワード欄を消すと
    // ブラウザによってはパスワード保存を認識できないことがある。
    client.on("error", err => {
        console.error("MQTT connection error", err.message);
        setMqttStatus("● MQTT Error: " + err.message);
    });
    client.on("close", () => setMqttStatus("● Disconnected"));

client.on(
    "connect",
    () =>
    {
        setMqttStatus("● Connected", true);
        // ログインが成功したらフォームを隠すことで、
        // 非同期ログインの成功をパスワードマネージャーが検出しやすくする。
        // 保存確認の表示はブラウザに依存する。
        document.getElementById("mqttLoginCard").hidden = true;

        // Subscribe to the reply BEFORE requesting data.
        client.subscribe([
            "room/sensor/state", "room/light/state", "room/aircon/state",
            HISTORY_RESPONSE_TOPIC
        ], err => {
            if (err) {
                setHistoryStatus("履歴の購読に失敗しました：権限を確認してください");
            }
        });
    }
);

client.on(
    "message",
    (topic, payload) =>
    {
        const msg =
            payload.toString();

        console.log(
            topic,
            msg
        );

        if (topic === HISTORY_RESPONSE_TOPIC) {
            handleHistoryMessage(msg);
            return;
        }

        updateMqttLastUpdate(
            topic
        );

        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            console.warn("Non-JSON MQTT message", topic);
            return;
        }

        //----------------------------------
        // Sensor
        //----------------------------------

        if(
            topic ===
            "room/sensor/state"
        )
        {
            document
                .getElementById(
                    "tempValue"
                )
                .innerText =
                data.temperature;

            document
                .getElementById(
                    "humidityValue"
                )
                .innerText =
                data.humidity;

            document
                .getElementById(
                    "co2Value"
                )
                .innerText =
                data.co2;

            document
                .getElementById(
                    "pressureValue"
                )
                .innerText =
                data.pressure;
            document
                .getElementById(
                    "absoluteHumidityValue"
                )
                .innerText =
                data.absolute_humidity;
        
            document
                .getElementById(
                    "dewPointValue"
                )
                .innerText =
                data.dew_point;
        }

        //----------------------------------
        // Light
        //----------------------------------

        if(
            topic ===
            "room/light/state"
        )
        {
            document
                .getElementById(
                    "lightPower"
                )
                .innerText =
                data.power ?
                "ON" :
                "OFF";

            document
                .getElementById(
                    "lightBrightness"
                )
                .innerText =
                data.brightness;

            document
                .getElementById(
                    "lightTimer"
                )
                .innerText =
                data.timer;
        }

        //----------------------------------
        // Aircon
        //----------------------------------

        if(
            topic ===
            "room/aircon/state"
        )
        {
            airconSetting =
            {
                power: data.power,
                mode: data.mode,
                temperature: data.temperature,
                fan: data.fan,
                swing_v: data.swing_v,
                swing_h: data.swing_h,
                warp: data.warp,
                bio: data.bio
            };
        
            updateAirconView();
        }
    }
);

}

function publishMqtt(topic, value) {
    if (!client || !client.connected) {
        alert("先にEMQXへ接続してください");
        return;
    }
    client.publish(topic, value);
}

function lightAllOn()
{
    publishMqtt(
        "room/light/all_on",
        "1"
    );
}

function lightOff()
{
    publishMqtt(
        "room/light/all_off",
        "1"
    );
}

function lightNight()
{
    publishMqtt(
        "room/light/night",
        "1"
    );
}

function lightDim()
{
    publishMqtt(
        "room/light/dim",
        "1"
    );
}

function lightTimer()
{
    publishMqtt(
        "room/light/timer",
        "1"
    );
}
let airconSetting =
{
    power: false,
    mode: "OFF",
    temperature: 26,
    fan: "AUTO",
    swing_v: "AUTO",
    swing_h: "AUTO",
    warp: "OFF",
    bio: "OFF"
};
function updateMqttLastUpdate(topic)
{
    const now =
        new Date();

    const timeText =
        now.toLocaleString(
            "ja-JP",
            {
                hour12: false
            }
        );

    document
        .getElementById(
            "mqttLastUpdate"
        )
        .innerText =
        timeText;

    document
        .getElementById(
            "mqttLastTopic"
        )
        .innerText =
        topic;
}

function updateAirconView()
{
    document.getElementById("airconMode").innerText =
        airconSetting.mode;

    document.getElementById("airconTemp").innerText =
        airconSetting.temperature;

    document.getElementById("airconFan").innerText =
        airconSetting.fan;

    document.getElementById("airconSwingV").innerText =
        airconSetting.swing_v;

    document.getElementById("airconSwingH").innerText =
        airconSetting.swing_h;

    document.getElementById("airconWarp").innerText =
        airconSetting.warp;

    document.getElementById("airconBio").innerText =
        airconSetting.bio;

    updateSelectedButtons();
}
function updateSelectedButtons()
{
    document
        .querySelectorAll(".optionBtn, .modeBtn")
        .forEach(button => {
            button.classList.remove("selected");
        });
    
    console.log(airconSetting.mode);
    
    setSelected("mode", airconSetting.mode);
    setSelected("fan", airconSetting.fan);
    setSelected("swing_v", airconSetting.swing_v);
    setSelected("swing_h", airconSetting.swing_h);

    if(airconSetting.warp === "ON")
    {
        setSelected("warp", "ON");
    }

    if(airconSetting.bio === "ON")
    {
        setSelected("bio", "ON");
    }
}

function setSelected(group, value)
{
    const button =
        document.querySelector(
            `[data-group="${group}"][data-value="${value}"]`
        );

    if(button)
    {
        button.classList.add("selected");
    }
}
function tempUp()
{
    if(airconSetting.temperature < 30)
    {
        airconSetting.temperature++;
    }

    updateAirconView();
}

function tempDown()
{
    if(airconSetting.temperature > 18)
    {
        airconSetting.temperature--;
    }

    updateAirconView();
}

function setAirconMode(mode)
{
    airconSetting.mode = mode;

    airconSetting.power =
        mode !== "OFF";

    updateAirconView();
}

function setAirconFan(fan)
{
    airconSetting.fan = fan;
    updateAirconView();
}

function setSwingV(swing)
{
    airconSetting.swing_v = swing;
    updateAirconView();
}

function setSwingH(swing)
{
    airconSetting.swing_h = swing;
    updateAirconView();
}

function toggleWarp()
{
    airconSetting.warp =
        airconSetting.warp === "ON" ? "OFF" : "ON";

    updateAirconView();
}

function toggleBio()
{
    airconSetting.bio =
        airconSetting.bio === "ON" ? "OFF" : "ON";

    updateAirconView();
}
function applyAircon()
{
    publishMqtt(
        "room/aircon/set",
        JSON.stringify(airconSetting)
    );

    console.log(
        "AIRCON APPLY",
        airconSetting
    );
}


// ============================================================
// History: response format is { id, seq, rows:[[epoch,t10,h10,co2,p10,ah10,dew10],...] }
// End: { id, seq, done:true, total:N }
// ============================================================
function setHistoryStatus(text) {
    const el = document.getElementById("historyStatus");
    if (el) el.textContent = text;
}

function requestHistory() {
    if (!client || !client.connected) {
        setHistoryStatus("先にEMQXへ接続してください。");
        return;
    }
    const hours = Number(document.getElementById("historyRange").value);
    if (![24, 168, 720].includes(hours)) return;
    historyRequestId = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    historyExpectedSeq = 0;
    historyHadGap = false;
    historyRows = [];
    document.getElementById("loadHistoryBtn").disabled = true;
    setHistoryStatus("ESP32に履歴を要求中…");
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
        setHistoryStatus("タイムアウト：ESP32の接続・履歴購読権限を確認して再試行してください。");
        document.getElementById("loadHistoryBtn").disabled = false;
        historyRequestId = null;
    }, 90000);

    client.publish("room/history/request", JSON.stringify({
        id: historyRequestId,
        client: HISTORY_CLIENT_ID,
        hours
    }), { qos: 0, retain: false }, err => {
        if (err) {
            setHistoryStatus("履歴要求を送信できませんでした。");
            document.getElementById("loadHistoryBtn").disabled = false;
            clearTimeout(historyTimer);
            historyRequestId = null;
        }
    });
}

function handleHistoryMessage(raw) {
    let msg;
    try { msg = JSON.parse(raw); }
    catch (e) { return; }
    if (!msg || msg.id !== historyRequestId) return;
    if (!Number.isInteger(msg.seq) || msg.seq !== historyExpectedSeq) {
        historyHadGap = true;
        // Keep displaying received records, but show a warning at completion.
        if (Number.isInteger(msg.seq)) historyExpectedSeq = msg.seq;
    }
    if (Array.isArray(msg.rows)) {
        for (const row of msg.rows) {
            if (!Array.isArray(row) || row.length !== 7) continue;
            historyRows.push({
                time: Number(row[0]) * 1000,
                temperature: Number(row[1]) / 10,
                humidity: Number(row[2]) / 10,
                co2: Number(row[3]),
                pressure: Number(row[4]) / 10,
                absolute_humidity: Number(row[5]) / 10,
                dew_point: Number(row[6]) / 10
            });
        }
        historyExpectedSeq++;
        setHistoryStatus(`受信中… ${historyRows.length} 件`);
    }
    if (msg.done === true) {
        if (historyTimer) clearTimeout(historyTimer);
        document.getElementById("loadHistoryBtn").disabled = false;
        historyRequestId = null;
        historyRows.sort((a, b) => a.time - b.time);
        const incomplete = historyHadGap || Number(msg.total) !== historyRows.length;
        setHistoryStatus(incomplete
            ? `${historyRows.length} 件受信（欠落の可能性があります。再取得してください）`
            : `${historyRows.length} 件取得しました。${historyRows.length ? "項目を切り替えて表示できます。" : "保存データはまだありません。"}`);
        renderHistoryChart();
    }
}

function renderHistoryChart() {
    if (typeof Chart === "undefined") {
        setHistoryStatus("Chart.jsの読み込みに失敗しました。ネットワークを確認してください。");
        return;
    }
    const metric = document.getElementById("historyMetric").value;
    const titles = {
        temperature: ["温度", "℃"], humidity: ["湿度", "%"],
        co2: ["CO₂", "ppm"], pressure: ["気圧", "hPa"],
        absolute_humidity: ["絶対湿度", "g/m³"], dew_point: ["露点", "℃"]
    };
    const title = titles[metric];
    if (!title) return;
    const labels = historyRows.map(row => new Date(row.time).toLocaleString("ja-JP", {
        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
    }));
    const values = historyRows.map(row => row[metric]);
    if (historyChart) historyChart.destroy();
    historyChart = new Chart(document.getElementById("historyChart"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `${title[0]} (${title[1]})`, data: values,
                borderColor: "#38bdf8", backgroundColor: "rgba(56,189,248,.15)",
                pointRadius: 0, pointHitRadius: 8, borderWidth: 2,
                tension: .12, fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { ticks: { color: "#cbd5e1", maxTicksLimit: 6, maxRotation: 0 }, grid: { color: "#334155" } },
                y: { ticks: { color: "#cbd5e1" }, grid: { color: "#334155" } }
            },
            plugins: {
                legend: { labels: { color: "#e2e8f0" } },
                decimation: { enabled: true, algorithm: "min-max" }
            }
        }
    });
}
