import { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';

type Kid = {
    id: number;
    firstName: string;
    lastName: string;
    className: string;
};
type SchoolInfo = {
    key: string;
    value: string;
};
type Termin = {
    id: number;
    title: string;
    title_short: string;
    class: "event-info";
    bo_end: 0 | 1;
    startDate: Date;
    endDate: Date;
};
type Schulaufgabe = {
    id: number;
    title: string;
    date: Date;
};
type Elternbrief = {
    id: number;
    readConfirmationId: number | undefined;
    status: string;
    title: string;
    messageText: string;
    classes: string;
    date: string;
    link: string;
};
type ElternPortalApiClientConfig = {
    short: string;
    username: string;
    password: string;
    kidId: number | undefined;
};
type SchwarzesBrettBox = {
    id: number | null;
    archived: Boolean;
    dateStart: string;
    dateEnd: string | null;
    title: string;
    content: string;
    link: string | undefined;
};
type ElternportalFile = {
    name: string;
    buffer: Buffer;
};
type Vertretung = {
    date: Date;
    period: number;
    originalTeacher: string;
    substituteTeacher: string;
    originalClass: string;
    substituteClass: string;
    room: string;
    note: string;
};
type VertretungsPlan = {
    lastUpdate: Date | undefined;
    substitutions: Vertretung[];
};
/** gives you a new ElternPortalApiClient instance */
declare function getElternportalClient(config: ElternPortalApiClientConfig): Promise<InstanceType<typeof ElternPortalApiClient>>;
declare class ElternPortalApiClient {
    jar: CookieJar;
    client: AxiosInstance;
    short: string;
    username: string;
    password: string;
    kidId: number;
    csrf: string;
    constructor(config: ElternPortalApiClientConfig);
    init(): Promise<void>;
    setKid(kidId: number): Promise<void>;
    /** list all kids in account */
    getKids(): Promise<Kid[]>;
    /** get array of blackboard items */
    getSchwarzesBrett(includeArchived?: boolean): Promise<SchwarzesBrettBox[]>;
    /** get school infos as key value json array */
    getSchoolInfos(): Promise<SchoolInfo[]>;
    /** get termine of entire school */
    getTermine(from?: number, to?: number): Promise<Termin[]>;
    getSchulaufgabenplan(): Promise<Schulaufgabe[]>;
    private getFromAndToParams;
    /** get timetable of currently selected kid */
    getStundenplan(): Promise<any>;
    /** Returns HTML Markup of a page */
    getRawContent(endpoint: string): Promise<string>;
    /** get substitutions */
    getVertretungsplan(): Promise<VertretungsPlan>;
    /** get lost and found items */
    getFundsachen(): Promise<string[]>;
    /** get parents letters */
    getElternbriefe(): Promise<Elternbrief[]>;
    getSchwarzesBrettFile(id: number): Promise<ElternportalFile>;
    getElternbrief(id: number, validateElternbriefReceipt?: boolean): Promise<ElternportalFile>;
    private validateElternbriefReceipt;
    private getFileBuffer;
    private getIdFromTitle;
    toDate(dateString: string): Date;
    timestampToDate(timestamp: number): Date;
    private htmlToPlainText;
}

export { ElternPortalApiClient, type ElternportalFile, type Schulaufgabe, getElternportalClient };
