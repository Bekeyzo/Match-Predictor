package utils

import (
	"context"
	"encoding/json"
	"os"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

func PublishRetrainMessage(leagueCode string) error {
	conn, err := amqp.Dial(os.Getenv("RABBITMQ_URL"))
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	// Declare the same queue Python is listening on
	_, err = ch.QueueDeclare(
		"retrain_queue",
		true,  // durable — survives RabbitMQ restart
		false, // auto-delete
		false, // exclusive
		false, // no-wait
		nil,
	)
	if err != nil {
		return err
	}

	// Build the message
	body, err := json.Marshal(map[string]string{"league_code": leagueCode})
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Publish the message
	return ch.PublishWithContext(ctx,
		"",              // exchange
		"retrain_queue", // routing key = queue name
		false,           // mandatory
		false,           // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			Body:         body,
			DeliveryMode: amqp.Persistent, // survive RabbitMQ restart
		},
	)
}
