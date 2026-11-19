<?php
declare(strict_types=1);

// Private queue records are accessed only by the authenticated server. The seat
// contains a boolean guard, never the queue's buyer identifiers.
function waitlist_member_id(string $eventId, string $uid): string { return hash('sha256', $eventId . '|' . $uid); }
function waitlist_notice(FirebaseFirestoreTransaction $tx, string $uid, string $message, string $seatId, string $eventId, string $sectionId, int $emailExpiry = 0): void
{
    $tx->create('Notifications', backend_new_document_id(), ['recipientUid'=>$uid,'message'=>$message,'type'=>'seat_waitlist',
        'relatedEntityType'=>'seat_waitlist','relatedEntityId'=>$seatId,'eventId'=>$eventId,'sectionId'=>$sectionId,'read'=>false,'createdAt'=>backend_now(),
        'emailExpiresAt'=>$emailExpiry]);
}

/** Advance on demand. A five-minute offer starts when issued, not while nobody is online. */
function waitlist_advance(FirebaseAdminRest $firebase, string $eventId, string $seatId): array
{
    return $firebase->transaction(static function(FirebaseFirestoreTransaction $tx) use($eventId,$seatId): array {
        $seat=$tx->get('EventSeats',$seatId); $queue=$tx->get('SeatWaitlists',$seatId);
        if (!$seat || ($seat['eventId']??'')!==$eventId) backend_fail(404,'Seat not found.','not-found');
        $seat['id']=$seatId;
        if (!$queue) return ['seat'=>$seat,'queue'=>[]];
        $event=$tx->get('Events',$eventId); $entries=$queue['entries']??[]; $offer=(string)($queue['offerUid']??'');
        $active=($seat['status']??'')==='RESERVED' && backend_reservation_is_active($seat);
        $closed=!$event || !backend_sales_are_open($event) || !backend_category_for_section($event['categories']??[],$seat['sectionId']) || ($seat['status']??'')==='SOLD';
        if (!$closed && $active) return ['seat'=>$seat,'queue'=>$queue];
        $removed=[]; if ($offer!=='') $removed[]=$offer;
        $next='';
        if (!$closed) {
            while ($entries) {
                $candidate=array_shift($entries); $who=(string)($candidate['uid']??'');
                $profile=$tx->get('Users',$who);
                $valid=$profile && ($profile['role']??'')==='buyer' && ($profile['status']??'')==='active' && ($profile['emailVerified']??false)===true;
                if ($valid) {
                    $holds=$tx->query('EventSeats',['eventId'=>$eventId,'reservedBy'=>$who,'status'=>'RESERVED']);
                    $held=count(array_filter($holds,static fn($s)=>backend_reservation_is_active($s)));
                    $valid=backend_owned_ticket_count($tx,$eventId,$who)+$held<min(20,backend_max_tickets_per_buyer($event));
                }
                if ($valid) { $next=$who; break; }
                $removed[]=$who;
            }
        } else { foreach($entries as $entry) $removed[]=$entry['uid']; $entries=[]; }
        // All reads above precede writes, including eligibility checks.
        foreach(array_unique($removed) as $who) {
            $tx->delete('SeatWaitlistMembers',waitlist_member_id($eventId,$who));
            waitlist_notice($tx,$who,$closed?'The waiting list for '.$seat['seatLabel'].' has closed.':'Your waiting-list offer expired or you are no longer eligible for '.$seat['seatLabel'].'.',$seatId,$eventId,$seat['sectionId']);
        }
        $expiry=$next!==''?gmdate('Y-m-d\TH:i:s\Z',time()+300):'';
        $queue=array_merge($queue,['entries'=>$entries,'offerUid'=>$next,'offerExpiry'=>$expiry,'updatedAt'=>backend_now()]);
        $fields=['hasWaitlist'=>!$closed && ($next!=='' || count($entries)>0),'updatedAt'=>backend_now()];
        if (!$closed) $fields+=['status'=>$next!==''?'RESERVED':'AVAILABLE','reservedBy'=>$next,'reservedAt'=>$next!==''?backend_now():'',
            'reservationExpiry'=>$expiry,'reservationEventId'=>$next!==''?$eventId:''];
        $tx->update('SeatWaitlists',$seatId,$queue); $tx->update('EventSeats',$seatId,$fields);
        if($next!=='') waitlist_notice($tx,$next,'Seat '.$seat['seatLabel'].' is offered to you for 5 minutes. Open the seat picker to claim it.',$seatId,$eventId,$seat['sectionId'],(int)strtotime($expiry));
        return ['seat'=>array_merge($seat,$fields),'queue'=>$queue];
    });
}

function waitlist_refresh_event(FirebaseAdminRest $firebase,string $eventId): void
{
    foreach($firebase->queryDocuments('EventSeats',['eventId'=>$eventId,'hasWaitlist'=>true]) as $seat)
        if (($seat['status']??'')!=='RESERVED' || !backend_reservation_is_active($seat)) waitlist_advance($firebase,$eventId,$seat['id']);
}

function backend_seat_waitlist(FirebaseAdminRest $firebase,string $uid,array $data,bool $leave=false): array
{
    $eventId=backend_require_id($data['eventId']??null,'Event ID');
    $seatId=backend_require_id($data['seatDocId']??null,'Seat ID');
    $result=$firebase->transaction(static function(FirebaseFirestoreTransaction $tx) use($uid,$eventId,$seatId,$leave):array {
        $actor=backend_get_actor($tx,$uid);backend_assert_active_buyer($actor);
        $event=$tx->get('Events',$eventId);$seat=$tx->get('EventSeats',$seatId);
        $queue=$tx->get('SeatWaitlists',$seatId);$membership=$tx->get('SeatWaitlistMembers',waitlist_member_id($eventId,$uid));
        if(!$seat || ($seat['eventId']??'')!==$eventId) backend_fail(404,'Seat not found.','not-found');
        $entries=$queue['entries']??[];
        if($leave){
            $entries=array_values(array_filter($entries,static fn($entry)=>$entry['uid']!==$uid));
            $fields=['entries'=>$entries,'updatedAt'=>backend_now()];
            $offered=($queue['offerUid']??'')===$uid;
            if($offered)$fields+=['offerUid'=>'','offerExpiry'=>''];
            if($queue)$tx->update('SeatWaitlists',$seatId,$fields);
            if(($membership['seatDocId']??'')===$seatId)$tx->delete('SeatWaitlistMembers',waitlist_member_id($eventId,$uid));
            $seatFields=['hasWaitlist'=>count($entries)>0 || (!$offered && !empty($queue['offerUid']))];
            if($offered && ($seat['status']??'')==='RESERVED' && ($seat['reservedBy']??'')===$uid)
                $seatFields+=['status'=>'AVAILABLE','reservedBy'=>'','reservationExpiry'=>'','reservedAt'=>'','reservationEventId'=>''];
            $tx->update('EventSeats',$seatId,$seatFields);
            return ['left'=>true,'seatId'=>$seatId];
        }
        if(!$event || !backend_sales_are_open($event))backend_fail(412,'Ticket sales are not open.','failed-precondition');
        if(($seat['venueId']??'')!==($event['venueId']??'') || !backend_category_for_section($event['categories']??[],$seat['sectionId']))
            backend_fail(412,'This seat is no longer offered for this event.','failed-precondition');
        if(($membership['seatDocId']??'')===$seatId)return ['joined'=>true,'seatId'=>$seatId];
        if($membership)backend_fail(412,'You already have a waiting-list entry for this event. Leave it first.','failed-precondition');
        if(($seat['status']??'')!=='RESERVED' || !backend_reservation_is_active($seat) || ($seat['reservedBy']??'')===$uid)
            backend_fail(412,'Only a seat held by another buyer can be queued. Refresh availability.','failed-precondition');
        if(count($entries)>=50)backend_fail(412,'This seat waiting list is full.','resource-exhausted');
        $holds=$tx->query('EventSeats',['eventId'=>$eventId,'reservedBy'=>$uid,'status'=>'RESERVED']);
        if(backend_owned_ticket_count($tx,$eventId,$uid)+count(array_filter($holds,static fn($s)=>backend_reservation_is_active($s)))>=min(20,backend_max_tickets_per_buyer($event)))
            backend_fail(412,'You have reached the event ticket limit.','failed-precondition');
        $entries[]=['uid'=>$uid,'joinedAt'=>backend_now()];
        $fields=['eventId'=>$eventId,'seatDocId'=>$seatId,'sectionId'=>$seat['sectionId'],'entries'=>$entries,'updatedAt'=>backend_now()];
        if($queue)$tx->update('SeatWaitlists',$seatId,$fields);else $tx->create('SeatWaitlists',$seatId,$fields+['offerUid'=>'','offerExpiry'=>'']);
        $tx->create('SeatWaitlistMembers',waitlist_member_id($eventId,$uid),['eventId'=>$eventId,'seatDocId'=>$seatId,'buyerUid'=>$uid]);
        $tx->update('EventSeats',$seatId,['hasWaitlist'=>true]);
        waitlist_notice($tx,$uid,'You joined the waiting list for '.$seat['seatLabel'].'. Open the seat picker to view your position.',$seatId,$eventId,$seat['sectionId']);
        return ['joined'=>true,'position'=>count($entries),'seatId'=>$seatId];
    });
    if($leave)waitlist_advance($firebase,$eventId,$seatId);
    return $result;
}


/** Only the signed-in buyer's live offers; no notification-history scan. */
function backend_get_seat_offers(FirebaseAdminRest $firebase, string $uid): array
{
    backend_assert_active_buyer(backend_get_current_actor($firebase, $uid));
    // Advance this buyer's queued seats when a previous holder times out,
    // even when the buyer is browsing another TickSecure page.
    foreach ($firebase->queryDocuments('SeatWaitlistMembers', ['buyerUid' => $uid], [], 20) as $membership) {
        $seat = $firebase->getDocument('EventSeats', (string)$membership['seatDocId']);
        if ($seat && (($seat['status'] ?? '') !== 'RESERVED' || !backend_reservation_is_active($seat)))
            waitlist_advance($firebase, $membership['eventId'], $membership['seatDocId']);
    }
    $offers = [];
    foreach ($firebase->queryDocuments('SeatWaitlists', ['offerUid' => $uid], [], 20) as $queue) {
        if (strtotime((string)($queue['offerExpiry'] ?? '')) <= time()) continue;
        $seat = $firebase->getDocument('EventSeats', (string)($queue['seatDocId'] ?? $queue['id']));
        if (!$seat || ($seat['reservedBy'] ?? '') !== $uid || ($seat['status'] ?? '') !== 'RESERVED'
            || !backend_reservation_is_active($seat) || ($seat['reservationExpiry'] ?? '') !== $queue['offerExpiry']) continue;
        $event = $firebase->getDocument('Events', (string)$seat['eventId']);
        if (!$event || !backend_sales_are_open($event)) continue;
        $category = backend_category_for_section($event['categories'] ?? [], $seat['sectionId']);
        if (!$category) continue;
        $offers[] = ['seatId' => $queue['seatDocId'] ?? $queue['id'], 'seatLabel' => $seat['seatLabel'],
            'categoryName' => $category['name'] ?? '', 'eventName' => $event['eventName'] ?? $event['name'] ?? 'Your event',
            'eventId' => $seat['eventId'], 'sectionId' => $seat['sectionId'], 'reservationExpiry' => $queue['offerExpiry']];
    }
    return ['offers' => $offers];
}
