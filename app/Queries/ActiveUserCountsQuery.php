<?php

declare(strict_types=1);

namespace App\Queries;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Fluent;

final readonly class ActiveUserCountsQuery
{
    /**
     * The people seen each day of the range, oldest first, counted as each was first seen that day since tracking
     * started. Today's count is still growing.
     *
     * @return array<int, array{date: string, count: int}>
     */
    public function get(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return DB::table('active_user_counts')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get(['date', 'count'])
            ->mapInto(Fluent::class)
            ->map(fn (Fluent $row): array => ['date' => $row->string('date')->value(), 'count' => $row->integer('count')])
            ->all();
    }
}
