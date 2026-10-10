// The app's icon set. Every icon comes from here, never from an icon package
// directly, so swapping a glyph (or the whole library) is a one-file change.
//
// Icons are Hugeicons (stroke-rounded, free set) rendered through
// HugeiconsIcon. Each export is a plain component that takes SVG props, so
// call sites read like any other icon: <SearchIcon className="size-4" />.

import {
	Alert02Icon,
	AlertCircleIcon as AlertCircleGlyph,
	ArrowDown01Icon,
	ArrowLeft01Icon,
	ArrowLeft02Icon,
	ArrowRight01Icon,
	ArrowRight02Icon,
	ArrowUp01Icon,
	ArrowUpRight01Icon,
	BookOpen01Icon,
	BotIcon as BotGlyph,
	Call02Icon,
	Cancel01Icon,
	ChartColumnIcon,
	ChartIncreaseIcon,
	CheckmarkCircle02Icon,
	CircleIcon as CircleGlyph,
	CodeIcon as CodeGlyph,
	Copy01Icon,
	DashboardSquare01Icon,
	Delete02Icon,
	Download04Icon,
	DragDropVerticalIcon,
	File01Icon,
	FlashIcon,
	FloppyDiskIcon,
	GithubIcon as GithubGlyph,
	HandIcon as HandGlyph,
	InboxIcon as InboxGlyph,
	InformationCircleIcon,
	Key01Icon,
	LifebuoyIcon as LifebuoyGlyph,
	Linkedin01Icon,
	Loading03Icon,
	Logout01Icon,
	Mail01Icon,
	Menu01Icon,
	Message01Icon,
	MinusSignIcon,
	Moon02Icon,
	MoreHorizontalIcon as MoreHorizontalGlyph,
	MultiplicationSignCircleIcon,
	NewTwitterIcon,
	PencilEdit01Icon,
	PlayIcon as PlayGlyph,
	PlusSignIcon,
	RefreshIcon as RefreshGlyph,
	Search01Icon,
	SentIcon,
	Settings01Icon,
	SidebarLeftIcon,
	StopCircleIcon,
	Sun03Icon,
	Tag01Icon,
	TagsIcon as TagsGlyph,
	Tick02Icon,
	UnfoldMoreIcon,
	Upload04Icon,
	UserAdd01Icon,
	UserCircleIcon as UserCircleGlyph,
	UserIcon as UserGlyph,
	UserGroupIcon,
	UserRemove01Icon,
	ViewIcon,
	ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import {
	HugeiconsIcon,
	type HugeiconsIconProps,
	type IconSvgElement,
} from "@hugeicons/react";
import type * as React from "react";

export type IconProps = Omit<HugeiconsIconProps, "icon" | "altIcon">;

/** Any icon from this module — use for `icon` props and nav configs. */
export type IconComponent = React.ComponentType<IconProps>;

function createIcon(glyph: IconSvgElement, name: string): IconComponent {
	function Icon(props: IconProps) {
		return (
			<HugeiconsIcon
				icon={glyph}
				strokeWidth={1.5}
				aria-hidden={props["aria-label"] ? undefined : true}
				{...props}
			/>
		);
	}
	Icon.displayName = name;
	return Icon;
}

// Navigation & direction
export const ArrowLeftIcon = createIcon(ArrowLeft02Icon, "ArrowLeftIcon");
export const ArrowRightIcon = createIcon(ArrowRight02Icon, "ArrowRightIcon");
export const ChevronDownIcon = createIcon(ArrowDown01Icon, "ChevronDownIcon");
export const ChevronLeftIcon = createIcon(ArrowLeft01Icon, "ChevronLeftIcon");
export const ChevronRightIcon = createIcon(
	ArrowRight01Icon,
	"ChevronRightIcon",
);
export const ChevronUpIcon = createIcon(ArrowUp01Icon, "ChevronUpIcon");
export const ChevronsUpDownIcon = createIcon(
	UnfoldMoreIcon,
	"ChevronsUpDownIcon",
);
export const ExternalLinkIcon = createIcon(
	ArrowUpRight01Icon,
	"ExternalLinkIcon",
);
export const MenuIcon = createIcon(Menu01Icon, "MenuIcon");
export const PanelLeftIcon = createIcon(SidebarLeftIcon, "PanelLeftIcon");
export const GripVerticalIcon = createIcon(
	DragDropVerticalIcon,
	"GripVerticalIcon",
);
export const MoreHorizontalIcon = createIcon(
	MoreHorizontalGlyph,
	"MoreHorizontalIcon",
);

// Actions
export const CheckIcon = createIcon(Tick02Icon, "CheckIcon");
export const XIcon = createIcon(Cancel01Icon, "XIcon");
export const PlusIcon = createIcon(PlusSignIcon, "PlusIcon");
export const MinusIcon = createIcon(MinusSignIcon, "MinusIcon");
export const CopyIcon = createIcon(Copy01Icon, "CopyIcon");
export const DownloadIcon = createIcon(Download04Icon, "DownloadIcon");
export const UploadIcon = createIcon(Upload04Icon, "UploadIcon");
export const PencilIcon = createIcon(PencilEdit01Icon, "PencilIcon");
export const SaveIcon = createIcon(FloppyDiskIcon, "SaveIcon");
export const SearchIcon = createIcon(Search01Icon, "SearchIcon");
export const SendIcon = createIcon(SentIcon, "SendIcon");
export const TrashIcon = createIcon(Delete02Icon, "TrashIcon");
export const RefreshIcon = createIcon(RefreshGlyph, "RefreshIcon");
export const PlayIcon = createIcon(PlayGlyph, "PlayIcon");
export const StopIcon = createIcon(StopCircleIcon, "StopIcon");
export const EyeIcon = createIcon(ViewIcon, "EyeIcon");
export const EyeOffIcon = createIcon(ViewOffSlashIcon, "EyeOffIcon");
export const LogOutIcon = createIcon(Logout01Icon, "LogOutIcon");
export const HandIcon = createIcon(HandGlyph, "HandIcon");

// Status & feedback
export const SpinnerIcon = createIcon(Loading03Icon, "SpinnerIcon");
export const InfoIcon = createIcon(InformationCircleIcon, "InfoIcon");
export const AlertCircleIcon = createIcon(AlertCircleGlyph, "AlertCircleIcon");
export const AlertTriangleIcon = createIcon(Alert02Icon, "AlertTriangleIcon");
export const CircleCheckIcon = createIcon(
	CheckmarkCircle02Icon,
	"CircleCheckIcon",
);
export const CircleXIcon = createIcon(
	MultiplicationSignCircleIcon,
	"CircleXIcon",
);
export const CircleIcon = createIcon(CircleGlyph, "CircleIcon");

// Objects & places
export const BotIcon = createIcon(BotGlyph, "BotIcon");
export const BookIcon = createIcon(BookOpen01Icon, "BookIcon");
export const ChartIcon = createIcon(ChartColumnIcon, "ChartIcon");
export const TrendingUpIcon = createIcon(ChartIncreaseIcon, "TrendingUpIcon");
export const CodeIcon = createIcon(CodeGlyph, "CodeIcon");
export const DashboardIcon = createIcon(DashboardSquare01Icon, "DashboardIcon");
export const FileTextIcon = createIcon(File01Icon, "FileTextIcon");
export const InboxIcon = createIcon(InboxGlyph, "InboxIcon");
export const KeyIcon = createIcon(Key01Icon, "KeyIcon");
export const LifebuoyIcon = createIcon(LifebuoyGlyph, "LifebuoyIcon");
export const MailIcon = createIcon(Mail01Icon, "MailIcon");
export const MessageIcon = createIcon(Message01Icon, "MessageIcon");
export const PhoneIcon = createIcon(Call02Icon, "PhoneIcon");
export const SettingsIcon = createIcon(Settings01Icon, "SettingsIcon");
export const TagIcon = createIcon(Tag01Icon, "TagIcon");
export const TagsIcon = createIcon(TagsGlyph, "TagsIcon");
export const ZapIcon = createIcon(FlashIcon, "ZapIcon");
export const MoonIcon = createIcon(Moon02Icon, "MoonIcon");
export const SunIcon = createIcon(Sun03Icon, "SunIcon");

// People
export const UserIcon = createIcon(UserGlyph, "UserIcon");
export const UserCircleIcon = createIcon(UserCircleGlyph, "UserCircleIcon");
export const UserPlusIcon = createIcon(UserAdd01Icon, "UserPlusIcon");
export const UserMinusIcon = createIcon(UserRemove01Icon, "UserMinusIcon");
export const UsersIcon = createIcon(UserGroupIcon, "UsersIcon");

// Brands
export const GithubIcon = createIcon(GithubGlyph, "GithubIcon");
export const LinkedinIcon = createIcon(Linkedin01Icon, "LinkedinIcon");
export const TwitterIcon = createIcon(NewTwitterIcon, "TwitterIcon");
