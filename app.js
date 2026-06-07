const client = mqtt.connect(
    "wss://c33aa709ad5b447381d7574b4db4b5f5.s1.eu.hivemq.cloud:8884/mqtt",
    {
        username: "hikaru",
        password: "HiveMQ1234HiveMQ"
    }
);

client.on(
    "connect",
    () =>
    {
        document
            .getElementById(
                "mqttStatus"
            )
            .innerHTML =
            "● Connected";

        document
            .getElementById(
                "mqttStatus"
            )
            .className =
            "statusOn";

        client.subscribe(
            "room/#"
        );
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

        const data =
            JSON.parse(msg);

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
            document
                .getElementById(
                    "airconMode"
                )
                .innerText =
                data.mode;

            document
                .getElementById(
                    "airconTemp"
                )
                .innerText =
                data.temperature;
        }
    }
);

function lightAllOn()
{
    client.publish(
        "room/light/all_on",
        "1"
    );
}

function lightOff()
{
    client.publish(
        "room/light/all_off",
        "1"
    );
}

function lightNight()
{
    client.publish(
        "room/light/night",
        "1"
    );
}

function lightDim()
{
    client.publish(
        "room/light/dim",
        "1"
    );
}

function lightTimer()
{
    client.publish(
        "room/light/timer",
        "1"
    );
}

function airconCool()
{
    client.publish(
        "room/aircon/cool",
        "26"
    );
}

function airconHeat()
{
    client.publish(
        "room/aircon/heat",
        "22"
    );
}

function airconOff()
{
    client.publish(
        "room/aircon/off",
        "1"
    );
}
