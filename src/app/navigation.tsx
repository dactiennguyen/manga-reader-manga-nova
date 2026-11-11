import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AiIcon, HomeIcon, LibraryIcon, UserIcon } from '../ui/icons';
import { useWindowDimensions } from 'react-native';

import { msg, t } from '../core/i18n';
import { AssistantScreen } from '../features/assistant/AssistantScreen';
import { CanvasScreen } from '../features/canvas/CanvasScreen';
import { CharacterScreen } from '../features/characters/CharacterScreen';
import { ExportScreen } from '../features/export/ExportScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { LetteringScreen } from '../features/lettering/LetteringScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { PreferencesScreen } from '../features/onboarding/PreferencesScreen';
import { WelcomeScreen } from '../features/onboarding/WelcomeScreen';
import { OutlineScreen } from '../features/outline/OutlineScreen';
import { PanelLayoutScreen } from '../features/page/PanelLayoutScreen';
import { PreviewScreen } from '../features/preview/PreviewScreen';
import { AboutScreen } from '../features/profile/AboutScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { TrashScreen } from '../features/profile/TrashScreen';
import { BattleScreen } from '../features/nearby/BattleScreen';
import { CardSwapScreen } from '../features/nearby/CardSwapScreen';
import { CoDrawScreen } from '../features/nearby/CoDrawScreen';
import { DubScreen } from '../features/nearby/DubScreen';
import { MangakaCardScreen } from '../features/nearby/MangakaCardScreen';
import { NearbyScreen } from '../features/nearby/NearbyScreen';
import { ReadTogetherScreen } from '../features/nearby/ReadTogetherScreen';
import { RelayScreen } from '../features/nearby/RelayScreen';
import { RoomScreen } from '../features/nearby/RoomScreen';
import { SendStoryScreen } from '../features/nearby/SendStoryScreen';
import { NewProjectScreen } from '../features/project/NewProjectScreen';
import { ProjectScreen } from '../features/project/ProjectScreen';
import { ScriptScreen } from '../features/script/ScriptScreen';
import { StoryboardScreen } from '../features/storyboard/StoryboardScreen';
import { CardsScreen } from '../features/studio/CardsScreen';
import { ClubScreen } from '../features/studio/ClubScreen';
import { JourneyScreen } from '../features/studio/JourneyScreen';
import { MagazineScreen } from '../features/studio/MagazineScreen';
import { MailboxScreen } from '../features/studio/MailboxScreen';
import { WorldEntryScreen } from '../features/world/WorldEntryScreen';
import { WorldScreen } from '../features/world/WorldScreen';
import { useAppNavigation, type RootStackParamList, type TabParamList } from '../state/navigation';
import { useSettings } from '../state/useSettings';
import { DOCK_RAIL_WIDTH, Dock, useColor, type IconGlyph } from '../ui';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_META: Record<keyof TabParamList, { label: string; icon: IconGlyph }> = {
  Home: { label: msg('Home'), icon: HomeIcon },
  Library: { label: msg('Library'), icon: LibraryIcon },
  Assistant: { label: msg('Assistant'), icon: AiIcon },
  Profile: { label: msg('Profile'), icon: UserIcon },
};

function AppDock({ state, navigation }: BottomTabBarProps) {
  const root = useAppNavigation();
  return (
    <Dock
      onCreate={() => root.navigate('NewProject')}
      items={state.routes.map((route, index) => {
        const meta = TAB_META[route.name as keyof TabParamList];
        const selected = state.index === index;
        return {
          key: route.key,
          label: t(meta.label),
          icon: meta.icon,
          selected,
          onPress: () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          },
        };
      })}
    />
  );
}

const renderDock = (props: BottomTabBarProps) => <AppDock {...props} />;

function Tabs() {
  const bg = useColor('bg');
  const { width } = useWindowDimensions();
  return (
    <Tab.Navigator
      tabBar={renderDock}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: bg, paddingLeft: width >= 600 ? DOCK_RAIL_WIDTH : 0 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Assistant" component={AssistantScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const bg = useColor('bg');
  const onboarded = useSettings(s => s.onboarded);
  return (
    <Stack.Navigator
      initialRouteName={onboarded ? 'Tabs' : 'Welcome'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: bg } }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
      {/* Step-by-step screens go back one step at a time. The iOS swipe would close them and drop the input. */}
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Tabs" component={Tabs} options={{ animation: 'fade' }} />
      <Stack.Screen
        name="NewProject"
        component={NewProjectScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="Project" component={ProjectScreen} />
      <Stack.Screen name="Outline" component={OutlineScreen} />
      <Stack.Screen name="Script" component={ScriptScreen} />
      <Stack.Screen name="Character" component={CharacterScreen} />
      <Stack.Screen name="World" component={WorldScreen} />
      <Stack.Screen name="WorldEntry" component={WorldEntryScreen} />
      <Stack.Screen name="Storyboard" component={StoryboardScreen} />
      <Stack.Screen name="PanelLayout" component={PanelLayoutScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Canvas" component={CanvasScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="Lettering" component={LetteringScreen} options={{ gestureEnabled: false, animation: 'none' }} />
      <Stack.Screen name="Preview" component={PreviewScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Export" component={ExportScreen} />
      <Stack.Screen name="Trash" component={TrashScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Journey" component={JourneyScreen} />
      <Stack.Screen name="Club" component={ClubScreen} />
      <Stack.Screen name="Mailbox" component={MailboxScreen} />
      <Stack.Screen name="Cards" component={CardsScreen} />
      <Stack.Screen name="Magazine" component={MagazineScreen} />
      <Stack.Screen name="Nearby" component={NearbyScreen} />
      <Stack.Screen name="Room" component={RoomScreen} />
      <Stack.Screen name="CoDraw" component={CoDrawScreen} options={{ gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="Relay" component={RelayScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Battle" component={BattleScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="ReadTogether" component={ReadTogetherScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Dub" component={DubScreen} />
      <Stack.Screen name="CardSwap" component={CardSwapScreen} />
      <Stack.Screen name="MangakaCard" component={MangakaCardScreen} />
      <Stack.Screen name="SendStory" component={SendStoryScreen} />
    </Stack.Navigator>
  );
}
