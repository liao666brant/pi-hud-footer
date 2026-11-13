import assert from "node:assert/strict";
import test from "node:test";
import { createTokenRateTracker, estimateTokens } from "../extensions/hud-footer/token-rate.ts";

test("estimates CJK as one token per character and other text as four characters per token", () => {
	assert.equal(estimateTokens(""), 0);
	assert.equal(estimateTokens("中"), 1);
	assert.equal(estimateTokens("abcd"), 1);
	assert.equal(estimateTokens("中abcd"), 2);
	assert.equal(estimateTokens("😀"), 0.25);
});

test("steady Chinese output settles on the real token rate", () => {
	const tracker = createTokenRateTracker();
	for (let i = 0; i <= 6; i++) tracker.addDelta("中".repeat(20), i * 100);
	assert.equal(tracker.rate, 200);
});

test("a single burst does not replace the displayed rate", () => {
	const tracker = createTokenRateTracker();
	for (let i = 0; i <= 6; i++) tracker.addDelta("中".repeat(20), i * 100);
	tracker.addDelta("中".repeat(200), 700);
	assert.ok(tracker.rate !== undefined);
	assert.ok(tracker.rate > 200 && tracker.rate < 250);
});

test("a gap longer than the window does not become the rate denominator", () => {
	const tracker = createTokenRateTracker();
	tracker.addDelta("中".repeat(100), 0);
	tracker.addDelta("中".repeat(20), 3000);
	assert.equal(tracker.rate, undefined);
	tracker.addDelta("中".repeat(120), 3600);
	assert.equal(tracker.rate, 200);
});

test("message end replaces the window rate with that message's usage and duration", () => {
	const tracker = createTokenRateTracker();
	for (let i = 0; i <= 6; i++) tracker.addDelta("中".repeat(20), i * 100);
	assert.equal(tracker.rate, 200);

	tracker.finish({ usage: { output: 80 }, timestamp: 0, durationMs: 1600 }, 1600);
	assert.equal(tracker.rate, 50);

	tracker.reset();
	tracker.addDelta("中".repeat(10), 5000);
	tracker.finish({ usage: { output: 12 }, timestamp: 4000, durationMs: 2000 }, 6000);
	assert.equal(tracker.rate, 12);
});

test("message end keeps the streaming rate when usage or generation time is missing", () => {
	const tracker = createTokenRateTracker();
	for (let i = 0; i <= 6; i++) tracker.addDelta("中".repeat(20), i * 100);
	tracker.finish({ usage: { output: 0 }, timestamp: 0, durationMs: 1600 }, 1600);
	assert.equal(tracker.rate, 200);

	tracker.reset();
	tracker.addDelta("中".repeat(8), 1000);
	tracker.finish({ usage: { output: 50 }, timestamp: 0, durationMs: 1000 }, 1000);
	assert.equal(tracker.rate, undefined);
});

test("a new message keeps the displayed rate until it produces its own", () => {
	const tracker = createTokenRateTracker();
	for (let i = 0; i <= 6; i++) tracker.addDelta("中".repeat(20), i * 100);
	assert.equal(tracker.rate, 200);

	tracker.beginMessage();
	tracker.finish({ usage: { output: 0 }, timestamp: 10_000, durationMs: 1000 }, 11_000);
	assert.equal(tracker.rate, 200);

	tracker.addDelta("中".repeat(10), 20_000);
	assert.equal(tracker.rate, 200);
	for (let i = 1; i <= 6; i++) tracker.addDelta("中".repeat(10), 20_000 + i * 100);
	assert.equal(tracker.rate, 100);

	tracker.beginMessage();
	tracker.addDelta("中".repeat(12), 30_000);
	tracker.finish({ usage: { output: 12 }, timestamp: 29_000, durationMs: 2000 }, 31_000);
	assert.equal(tracker.rate, 12);

	tracker.reset();
	assert.equal(tracker.rate, undefined);
});

test("message end falls back to the message timestamp when durationMs is absent", () => {
	const tracker = createTokenRateTracker();
	tracker.addDelta("x", 1500);
	tracker.finish({ usage: { output: 30 }, timestamp: 1000 }, 3000);
	assert.equal(tracker.rate, 20);
});
