/// <reference types="node" />
import assert from 'node:assert/strict';
import * as React from 'react';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, test, vi } from 'vite-plus/test';
import type { DateTimePreferences } from '../../resources/js/lib/date-time';

const auth = {
    user: { timezone: 'Pacific/Honolulu' },
    dateTime: {} as DateTimePreferences,
};
let server = false;
const timezone = process.env.TZ;

vi.doMock('react', () => ({
    ...React,
    useSyncExternalStore: (
        _subscribe: unknown,
        getSnapshot: () => unknown,
        getServerSnapshot: () => unknown,
    ) => (server ? getServerSnapshot() : getSnapshot()),
}));
vi.doMock('@inertiajs/react', async () => ({
    ...(await vi.importActual('@inertiajs/react')),
    usePage: () => ({ props: { auth } }),
    Head: () => null,
    Deferred: ({ children }: { children: ReactNode }) => children,
}));

const { LocalTime } = await import('../../resources/js/components/local-time');
const { TooltipProvider } =
    await import('../../resources/js/components/ui/tooltip');
const { default: Metrics } =
    await import('../../resources/js/pages/operations/metrics');

afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = timezone;
    server = false;
});

test('profile clocks use the viewer clock preference in the profile owner timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T14:35:45Z'));
    auth.dateTime = { timeFormat: '24h' };
    const clock = () => renderToString(<LocalTime timeZone="Asia/Kathmandu" />);
    const html = clock();
    assert.match(html, />20:20<\/time>/);
    assert.match(html, /UTC \+05:45/);
    assert.match(html, /dateTime="2026-10-19T14:35:00.000Z"/);

    auth.dateTime = { timeFormat: '12h' };
    assert.match(clock(), />8:20\s*PM<\/time>/i);
    server = true;
    assert.equal(clock(), '');
});

test('metrics dates follow viewer date order without changing UTC buckets or date inputs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T14:35:00Z'));
    process.env.TZ = 'Pacific/Honolulu';
    const props: Parameters<typeof Metrics>[0] = {
        range: { from: '2026-10-18', to: '2026-10-19', all_time: false },
        activeUserCounts: [{ date: '2026-10-19', count: 3 }],
        activeUsers: { daily: 3, weekly: 5, monthly: 8, weekly_authors: 2 },
        responses: {
            commits: 3,
            answered: 1,
            median_minutes: 12,
            first_commits: 2,
            first_answered: 1,
        },
        newcomerFollows: {
            newcomers: 3,
            median_follows: 1,
            follows: 2,
            followed_back: 1,
        },
        funnel: {
            visitors: 10,
            signups: 3,
            acquisition_by_day: [
                {
                    date: '2026-10-19',
                    signups: 3,
                    visitors: 10,
                    converted: 2,
                    complete: true,
                },
            ],
            activated: 1,
            activation_eligible: 3,
            activation_by_day: [
                {
                    date: '2026-10-19',
                    activated: 1,
                    eligible: 3,
                    complete: true,
                },
            ],
            retained: 0,
            retention_eligible: 1,
            rates: { conversion: 0.2, activation: 1 / 3, retention: 0 },
            changes: { conversion: null, activation: null, retention: null },
        },
    };
    auth.dateTime = { dateFormat: 'day_first' };
    const page = () =>
        renderToString(
            <TooltipProvider>
                <Metrics {...props} />
            </TooltipProvider>,
        );
    const dayFirst = page();
    assert.match(dayFirst, />18 Oct<\/span>/);
    assert.equal(
        (dayFirst.match(/<th scope="row">19 Oct<\/th>/g) ?? []).length,
        3,
    );
    assert.match(dayFirst, /value="2026-10-18"/);
    assert.match(dayFirst, /value="2026-10-19"/);

    auth.dateTime = { dateFormat: 'month_first' };
    const monthFirst = page();
    assert.match(monthFirst, />Oct 18<\/span>/);
    assert.equal(
        (monthFirst.match(/<th scope="row">Oct 19<\/th>/g) ?? []).length,
        3,
    );
});
