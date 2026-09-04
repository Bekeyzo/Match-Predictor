package main

import (
	"fmt"
	"time"
)

// a cache entry: the value plus when it expires
type entry struct {
	value     any
	expiresAt time.Time
}

type SimpleCache struct {
	store map[string]entry
}

func NewSimpleCache() *SimpleCache {
	return &SimpleCache{store: map[string]entry{}}
}

func (c *SimpleCache) Set(key string, value any, ttlSeconds int) {
	c.store[key] = entry{
		value:     value,
		expiresAt: time.Now().Add(time.Duration(ttlSeconds) * time.Second),
	}
}

func (c *SimpleCache) Get(key string) (any, bool) {
	e, found := c.store[key]
	if !found {
		return nil, false // miss
	}
	if time.Now().After(e.expiresAt) {
		delete(c.store, key)
		return nil, false // expired = miss
	}
	return e.value, true // hit
}

// fake slow database — burns 2 seconds
func slowFetchUser(id int) map[string]any {
	time.Sleep(2 * time.Second)
	return map[string]any{"id": id, "name": "Emmanuel", "role": "backend dev"}
}

var cache = NewSimpleCache()

func getUser(id int) map[string]any {
	key := fmt.Sprintf("user:%d", id)

	if cached, ok := cache.Get(key); ok {
		fmt.Println("HIT  — instant")
		return cached.(map[string]any)
	}

	fmt.Println("MISS — doing slow fetch...")
	user := slowFetchUser(id)
	cache.Set(key, user, 10)
	return user
}

func main() {
	fmt.Println(getUser(1))
	fmt.Println(getUser(1))
}
