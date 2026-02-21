"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/Card";
import { Maximize2, Mic, ArrowUp, Send } from "lucide-react";
import { Input } from "@/components/Input"; // Assuming we have this or similar
import { useState } from "react";

export function AIAssistantCard() {
    const [query, setQuery] = useState("");

    return (
        <Card className="border-none shadow-sm bg-white rounded-2xl h-full flex flex-col justify-between overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
                <CardTitle className="text-base font-semibold text-gray-900">AI Assistant</CardTitle>
                <button className="text-gray-400 hover:text-gray-600">
                    <Maximize2 className="w-4 h-4" />
                </button>
            </CardHeader>

            <CardBody className="flex-1 flex flex-col items-center justify-center min-h-[160px]">
                {/* Orb Visualization / Placeholder */}
                <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500 blur-md opacity-80 animate-pulse"></div>
                    <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-600 shadow-lg"></div>
                </div>
            </CardBody>

            <div className="p-4 pt-0">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Ask me anything..."
                        className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-1 focus:ring-blue-500 outline-none text-gray-700 placeholder:text-gray-400"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button className="p-1.5 rounded-full hover:bg-white text-gray-400 transition-colors">
                            <Mic className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm">
                            <ArrowUp className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
