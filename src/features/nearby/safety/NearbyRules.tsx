import type { ReactNode } from 'react';
import { Linking, View } from 'react-native';

import { t } from '../../../core/i18n';
import { SUPPORT_EMAIL } from '../../../core/model/constants';
import { NEARBY_RULES_VERSION, TERMS_URL } from '../../../core/nearby/safety';
import { useAppNavigation } from '../../../state/navigation';
import { useNearbyRulesAccepted, useSettings } from '../../../state/useSettings';
import { AppBar, ArtBanner, Button, Card, Icon, ListItem, Screen, Sheet, Text, toast, type IconGlyph } from '../../../ui';
import { BlockPersonIcon, CheckIcon, DocumentIcon, HiddenIcon, KindIcon, MailIcon, RemovePersonIcon, WarningIcon } from '../../../ui/icons';
import { NEARBY_ART } from '../../../ui/nearbyArt';

/** Something to do once the rules are agreed, such as joining the room of a scanned QR code. */
let afterAgree: (() => void) | null = null;

/** Runs `run` now when the rules are already agreed; otherwise keeps it for the moment they are. */
export function afterNearbyRules(run: () => void, accepted: boolean): void {
  if (accepted) {
    afterAgree = null;
    run();
  } else {
    afterAgree = run;
  }
}

function Rule({ icon, text }: { icon: IconGlyph; text: string }) {
  return (
    <View className="flex-row items-start gap-3 py-2">
      <Icon icon={icon} color="accent" />
      <Text className="flex-1">{text}</Text>
    </View>
  );
}

function openTerms() {
  Linking.openURL(TERMS_URL).catch(() => toast(t("This link can't be opened.")));
}

/** The rules themselves, as everyone agrees to them. */
export function NearbyRulesList() {
  return (
    <View>
      <Rule icon={KindIcon} text={t('Be kind to everyone in the room.')} />
      <Rule icon={WarningIcon} text={t('No hateful, sexual, harassing or threatening drawings, words or voice recordings. There is zero tolerance for this.')} />
      <Rule icon={BlockPersonIcon} text={t('Anyone can block or report you.')} />
      <Rule icon={RemovePersonIcon} text={t('The host can remove you from the room.')} />
      <Rule icon={HiddenIcon} text={t('Offensive words are hidden automatically.')} />
      <Rule icon={MailIcon} text={t('Reports sent to the developer at {email} are reviewed within 24 hours.', { email: SUPPORT_EMAIL })} />
    </View>
  );
}

function TermsLink() {
  return <ListItem icon={DocumentIcon} title={t('Terms of use')} subtitle="manganova.pages.dev/terms" chevron onPress={openTerms} />;
}

/**
 * Play together starts with its rules (App Store guideline 1.2): until the person agrees, the hub, the
 * mangaka card and a scanned room link show the rules instead, and no room can be hosted or joined
 * (core/nearby/room.ts refuses too). "Not now" goes back.
 */
export function NearbyRulesGate({ children }: { children: ReactNode }) {
  const accepted = useNearbyRulesAccepted();
  const navigation = useAppNavigation();
  if (accepted) {
    return <>{children}</>;
  }
  const agree = () => {
    useSettings.getState().set({ nearbyRulesAccepted: NEARBY_RULES_VERSION });
    const run = afterAgree;
    afterAgree = null;
    run?.();
  };
  const notNow = () => {
    afterAgree = null;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Tabs');
    }
  };
  return (
    <Screen scroll>
      <AppBar title={t('Play together')} onBack={notNow} />
      <ArtBanner source={NEARBY_ART.hub} ratio={2} />
      <View className="gap-1">
        <Text variant="title" accessibilityRole="header">
          {t('Play together rules')}
        </Text>
        <Text tone="secondary">{t('You play with real people. Agree to these rules before you host or join a room.')}</Text>
      </View>
      <Card className="px-4 py-2">
        <NearbyRulesList />
      </Card>
      <Card className="overflow-hidden">
        <TermsLink />
      </Card>
      <View className="gap-3">
        <Button title={t('I agree')} icon={CheckIcon} onPress={agree} />
        <Button title={t('Not now')} variant="ghost" onPress={notNow} />
      </View>
    </Screen>
  );
}

/** The rules again, from Profile. */
export function NearbyRulesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const accepted = useNearbyRulesAccepted();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('Play together rules')} subtitle={accepted ? t('You agreed to these rules.') : undefined}>
      <View className="gap-2 px-4 pb-2">
        <NearbyRulesList />
        <View className="-mx-4">
          <TermsLink />
        </View>
        <Button title={t('Close')} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
