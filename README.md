# SIF Virtual Sensor Demo

This project is designed to showcase how data can be pushed to the SIF cloud platform. It uses a "virtual sensor" -- an abstraction I have created that generates artificial data and takes the place of an actual, real-world, data source -- and outputs authenticated data blobs. These blobs can be either logged to stdout for debugging, or sent to SIF's MQTT broker, where the data will be ingested and permanently stored.
