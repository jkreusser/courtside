"use client";

import { Skeleton } from "./skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./Card";

/**
 * Skeleton für Card-Layout
 */
export function CardSkeleton({ className, children, ...props }) {
  return (
    <Card className={className} {...props}>
      <CardContent className="space-y-4 p-6">{children}</CardContent>
    </Card>
  );
}

/**
 * Skeleton für Spieler-Karten (mit Avatar)
 */
export function PlayerCardSkeleton({ className }) {
  return (
    <div className={`p-4 border rounded-lg ${className || ""}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton für Spiel-Karten
 */
export function GameCardSkeleton({ className }) {
  return (
    <CardSkeleton className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </CardSkeleton>
  );
}

/**
 * Skeleton für Charts/Graphen
 */
export function ChartSkeleton({ className }) {
  return (
    <CardSkeleton className={className}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="h-64 flex items-end justify-between space-x-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className="w-full"
            style={{ height: `${Math.random() * 60 + 40}%` }}
          />
        ))}
      </div>
    </CardSkeleton>
  );
}

/**
 * Skeleton für Rankings-Tabelle
 */
export function RankingsTableSkeleton({ rows = 5 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="text-left py-3 px-4">
              <Skeleton className="h-4 w-16" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, index) => (
            <tr key={index} className="border-b border-zinc-800">
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-8" />
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </td>
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-8" />
              </td>
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-8" />
              </td>
              <td className="py-4 px-4">
                <Skeleton className="h-4 w-12" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton für Dashboard-Layout
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
        <CardSkeleton>
          <Skeleton className="h-6 w-32" />
          <RankingsTableSkeleton rows={3} />
        </CardSkeleton>
      </div>

      {/* Recent Games */}
      <CardSkeleton>
        <Skeleton className="h-6 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <GameCardSkeleton key={index} className="border-0 p-0" />
          ))}
        </div>
      </CardSkeleton>
    </div>
  );
}

/**
 * Skeleton für Tabellen-Zeilen
 */
export function TableRowSkeleton({ columns = 6, className }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="py-4 px-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
