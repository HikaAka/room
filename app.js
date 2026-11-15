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
const historyCharts = {};
let historyTimer = null;
// CSV output is enabled only after a complete MQTT history transfer.
let historyRequestedHours = null;
let historyLoadedHours = null;
let historyReadyForCsv = false;


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
    historyRequestedHours = hours;
    historyLoadedHours = null;
    historyReadyForCsv = false;
    document.getElementById("downloadHistoryCsvBtn").disabled = true;
    document.getElementById("historyCsvStatus").textContent = "";
    document.getElementById("loadHistoryBtn").disabled = true;
    setHistoryStatus("ESP32に履歴を要求中…");
    if (historyTimer) clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
        setHistoryStatus("タイムアウト：ESP32の接続・履歴購読権限を確認して再試行してください。");
        document.getElementById("loadHistoryBtn").disabled = false;
        historyRequestId = null;
        historyRequestedHours = null;
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
            historyRequestedHours = null;
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
        historyLoadedHours = historyRequestedHours;
        historyRequestedHours = null;
        historyReadyForCsv = !incomplete && historyRows.length > 0;
        document.getElementById("downloadHistoryCsvBtn").disabled = !historyReadyForCsv;
        setHistoryStatus(incomplete
            ? `${historyRows.length} 件受信（欠落の可能性があります。再取得してください）`
            : `${historyRows.length} 件取得しました。${historyRows.length ? "項目を切り替えて表示できます。" : "保存データはまだありません。"}`);
        renderHistoryCharts();
    }
}

// ============================================================
// 履歴グラフ V4: SVGで直接描画（Chart.jsや外部CDNに依存しない）
// 受信済みの全件を使う。表示切替や画面サイズ変更で追加MQTT通信はしない。
// ============================================================
const historyChartVisibility = {};
const historyChartSpecs = [
    { id: "historyCo2Chart", axes: [{label:"ppm"}], series: [
        { key:"co2", label:"CO₂", color:"#4ade80", axis:0, unit:"ppm" }] },
    { id: "historyTemperatureChart", axes: [{label:"℃"}], series: [
        { key:"temperature", label:"室温", color:"#fb923c", axis:0, unit:"℃" },
        { key:"dew_point", label:"露点温度", color:"#60a5fa", axis:0, unit:"℃" }] },
    { id: "historyHumidityChart", axes: [{label:"%"},{label:"g/m³"}], series: [
        { key:"humidity", label:"相対湿度", color:"#22d3ee", axis:0, unit:"%" },
        { key:"absolute_humidity", label:"絶対湿度", color:"#c084fc", axis:1, unit:"g/m³" }] },
    { id: "historyPressureChart", axes: [{label:"hPa"}], series: [
        { key:"pressure", label:"気圧", color:"#facc15", axis:0, unit:"hPa" }] }
];
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs = {}, text = null) {
    const el = document.createElementNS(SVG_NS, name);
    for (const [key,value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (text !== null) el.textContent = String(text);
    return el;
}
function historyDateLabel(ms, verbose = false) {
    return new Date(ms).toLocaleString("ja-JP", {
        timeZone:"Asia/Tokyo", month:"numeric", day:"numeric",
        hour:"2-digit", minute:"2-digit", ...(verbose ? {year:"numeric"} : {})
    });
}
function numberLabel(n) {
    return Math.abs(n) >= 100 ? n.toFixed(0) : Math.abs(n) >= 10 ? n.toFixed(1) : n.toFixed(2);
}
function renderOneHistoryChart(spec) {
    const canvas = document.getElementById(spec.id);
    if (!canvas) throw new Error("グラフの表示領域がありません: " + spec.id);
    const wrap = canvas.parentElement;
    // V3のcanvasは再利用せずSVGで置き換える。既存のHTML構造は維持。
    canvas.hidden = true;
    canvas.style.display = "none";
    let region = wrap.querySelector(".nativeHistoryChart");
    if (!region) {
        region = document.createElement("div");
        region.className = "nativeHistoryChart";
        wrap.appendChild(region);
    }
    region.replaceChildren();
    if (!historyRows.length) {
        const empty = document.createElement("p"); empty.className="historyEmpty";
        empty.textContent = "まだ履歴がありません。"; region.appendChild(empty); return;
    }
    if (!historyChartVisibility[spec.id]) {
        historyChartVisibility[spec.id] = Object.fromEntries(spec.series.map(s => [s.key,true]));
    }
    const vis = historyChartVisibility[spec.id];
    const legend = document.createElement("div"); legend.className="historyLegend";
    for (const s of spec.series) {
        const btn = document.createElement("button");
        btn.type="button"; btn.className="historyLegendBtn";
        btn.setAttribute("aria-pressed", String(vis[s.key]));
        const dot = document.createElement("span"); dot.className="historyLegendDot";
        dot.style.backgroundColor=s.color;
        btn.append(dot, document.createTextNode(s.label + " (" + s.unit + ")"));
        btn.addEventListener("click", () => {
            vis[s.key]=!vis[s.key];
            renderOneHistoryChart(spec);
        });
        legend.appendChild(btn);
    }
    region.appendChild(legend);
    const width = Math.max(300, Math.floor(region.clientWidth || wrap.clientWidth || 720));
    const height = 248;
    const left = 56, right = spec.axes.length > 1 ? 59 : 17, top = 14, bottom = 39;
    const pw = width-left-right, ph=height-top-bottom;
    const svg = svgEl("svg", {viewBox:`0 0 ${width} ${height}`, width:"100%", height:height,
        role:"img", "aria-label":"センサ履歴折れ線グラフ"});
    const minTime = historyRows[0].time;
    const maxTime = historyRows[historyRows.length-1].time;
    const deltaTime = Math.max(1, maxTime-minTime);
    const px = ms => left+(ms-minTime)/deltaTime*pw;
    // 各軸に紐づく表示中系列から、その軸の最小/最大を計算する。
    const axisRanges = spec.axes.map((ax,axisIndex) => {
        const values = spec.series.filter(s => s.axis === axisIndex && vis[s.key])
          .flatMap(s => historyRows.map(row => Number(row[s.key])).filter(Number.isFinite));
        let lo = values.length ? Math.min(...values) : 0;
        let hi = values.length ? Math.max(...values) : 1;
        const spread = Math.max((hi-lo)*0.1, Math.abs(hi)*0.002, 0.05);
        lo-=spread; hi+=spread;
        return {lo, hi, py:v=>top+(hi-v)/(hi-lo)*ph};
    });
    // Y座標の目盛り・グリッド
    for(let i=0;i<=4;i++) {
        const y = top+(ph*i/4);
        svg.appendChild(svgEl("line",{x1:left,y1:y,x2:width-right,y2:y,stroke:"#506079","stroke-opacity":0.45,"stroke-dasharray":"3 4"}));
        axisRanges.forEach((a,k) => {
            const val=a.hi-(a.hi-a.lo)*i/4;
            svg.appendChild(svgEl("text",{
                x:k===0?left-7:width-right+7,y:y+4,"text-anchor":k===0?"end":"start",
                "font-size":11, fill:k===0?"#cbd5e1":"#c084fc"
            }, numberLabel(val)));
        });
    }
    svg.appendChild(svgEl("line",{x1:left,y1:top,x2:left,y2:top+ph,stroke:"#64748b"}));
    svg.appendChild(svgEl("line",{x1:left,y1:top+ph,x2:width-right,y2:top+ph,stroke:"#64748b"}));
    [0,0.25,0.5,0.75,1].forEach(t => {
        const x=left+pw*t;
        const time=minTime+deltaTime*t;
        svg.appendChild(svgEl("text",{x, y:height-14,"text-anchor":t===0?"start":t===1?"end":"middle",
            "font-size":10,fill:"#cbd5e1"}, historyDateLabel(time)));
    });
    for (const s of spec.series.filter(s => vis[s.key])) {
        const range = axisRanges[s.axis];
        let path="";
        let drawing = false;
        for (const row of historyRows) {
            const v=Number(row[s.key]);
            if(!Number.isFinite(v) || !Number.isFinite(row.time)) { drawing = false; continue; }
            const x=px(row.time).toFixed(2), y=range.py(v).toFixed(2);
            path+=(drawing ? "L" : "M")+x+","+y+" ";
            drawing = true;
        }
        // 同一点しかない場合も表示できるよう丸を描く。
        svg.appendChild(svgEl("path",{d:path,fill:"none",stroke:s.color,"stroke-width":2.2,
           "stroke-linecap":"round","stroke-linejoin":"round", "vector-effect":"non-scaling-stroke"}));
        if (historyRows.length <= 36) {
            for (const row of historyRows) {
                const v=Number(row[s.key]);
                if(Number.isFinite(v)) svg.appendChild(svgEl("circle",{cx:px(row.time), cy:range.py(v),r:3,fill:s.color}));
            }
        }
    }
    const cursor=svgEl("line",{x1:left,y1:top,x2:left,y2:top+ph,stroke:"#e2e8f0",
       "stroke-opacity":"0.65","stroke-dasharray":"4 3",visibility:"hidden"});
    svg.appendChild(cursor);
    const hit=svgEl("rect",{x:left,y:top,width:pw,height:ph,fill:"transparent",style:"cursor:crosshair"});
    svg.appendChild(hit);
    const tip=document.createElement("div");
    tip.className="historyHoverInfo";
    tip.textContent="グラフ上にマウスを重ねると各測定値を表示します";
    function move(event) {
        const b=svg.getBoundingClientRect();
        const mouseX=(event.clientX-b.left)/b.width*width;
        const clamped=Math.max(left,Math.min(width-right,mouseX));
        const target=minTime+(clamped-left)/pw*deltaTime;
        // 時刻が等間隔でなくても最も近い測定点を選ぶ
        let lo=0,hi=historyRows.length-1;
        while(lo<hi){const mid=(lo+hi)>>1; if(historyRows[mid].time<target)lo=mid+1;else hi=mid;}
        const i=lo>0 && Math.abs(historyRows[lo-1].time-target)<Math.abs(historyRows[lo].time-target)?lo-1:lo;
        const row=historyRows[i]; const x=px(row.time);
        cursor.setAttribute("x1",x);cursor.setAttribute("x2",x);cursor.setAttribute("visibility","visible");
        tip.textContent=historyDateLabel(row.time,true)+"  |  "+spec.series.filter(s=>vis[s.key])
           .map(s=>`${s.label}: ${Number.isFinite(row[s.key])?row[s.key]:"—"} ${s.unit}`).join("  /  ");
    }
    hit.addEventListener("pointermove",move);
    hit.addEventListener("pointerdown",move);
    hit.addEventListener("pointerleave",()=>cursor.setAttribute("visibility","hidden"));
    region.append(svg,tip);
}
function renderHistoryCharts() {
    try {
        for(const spec of historyChartSpecs) renderOneHistoryChart(spec);
    } catch (err) {
        console.error("履歴グラフの描画エラー",err);
        setHistoryStatus("履歴は取得済みですがグラフ描画でエラーが発生しました: " + err.message);
    }
}
let historyResizeTimer;
window.addEventListener("resize", () => {
    if (!historyRows.length) return;
    clearTimeout(historyResizeTimer);
    historyResizeTimer = setTimeout(renderHistoryCharts,160);
});


// ============================================================
// CSV export of the *received* history (no extra MQTT requests).
// Dates are always Asia/Tokyo, regardless of browser time zone.
// UTF-8 BOM + CRLF support Japanese column names in Excel.
// ============================================================
function downloadHistoryCsv() {
    if (!historyReadyForCsv || !historyLoadedHours || historyRequestId || !historyRows.length) {
        document.getElementById("historyCsvStatus").textContent =
            "先に履歴の取得を完了してください。";
        return;
    }

    const formatter = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    const formatJst = ms => {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(ms))
            .filter(part => part.type !== "literal")
            .map(part => [part.type, part.value]));
        return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    };
    const numeric = value => Number.isFinite(value) ? String(value) : "";
    const lines = [
        "日時(JST),UNIX時刻,温度(℃),相対湿度(%),絶対湿度(g/m³),露点(℃),CO2(ppm),気圧(hPa)"
    ];
    for (const row of historyRows) {
        if (!Number.isFinite(row.time)) continue;
        lines.push([
            formatJst(row.time),
            Math.floor(row.time / 1000),
            numeric(row.temperature),
            numeric(row.humidity),
            numeric(row.absolute_humidity),
            numeric(row.dew_point),
            numeric(row.co2),
            numeric(row.pressure)
        ].join(","));
    }
    if (lines.length === 1) {
        document.getElementById("historyCsvStatus").textContent = "出力できるデータがありません。";
        return;
    }

    // The browser creates this file locally; credentials are not included.
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const timestamp = formatJst(Date.now()).replace(/\D/g, "").slice(0, 12);
    const filename = `room_history_${historyLoadedHours}h_${timestamp}_JST.csv`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    document.getElementById("historyCsvStatus").textContent =
        `${lines.length - 1}件をCSVで保存しました（${historyLoadedHours}時間分、時刻はJST）。`;
}
