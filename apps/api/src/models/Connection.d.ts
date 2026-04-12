import mongoose from "mongoose";
export declare const Connection: mongoose.Model<{
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
}, {}, {}, {}, mongoose.Document<unknown, {}, {
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
}, {}, mongoose.DefaultSchemaOptions> & {
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
} & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}, mongoose.Schema<any, mongoose.Model<any, any, any, any, any, any>, {}, {}, {}, {}, mongoose.DefaultSchemaOptions, {
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
}, mongoose.Document<unknown, {}, mongoose.FlatRecord<{
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
}>, {}, mongoose.DefaultSchemaOptions> & mongoose.FlatRecord<{
    userId: mongoose.Types.ObjectId;
    type: "mongodb" | "sheets" | "supabase" | "postgresql";
    name: string;
    config: string;
    createdAt: NativeDate;
    metadata?: {
        status: string;
        lastSynced?: NativeDate | null | undefined;
        sourceInfo?: any;
    } | null | undefined;
}> & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>>;
