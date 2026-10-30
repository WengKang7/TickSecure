<?php
declare(strict_types=1);

/** PHP verifies the ID token; the shared Node backend checks roles, policy and chain receipts.
 *  Using one implementation keeps XAMPP and callable Functions on the same authorization rules. */
final class TickSecureBlockchain
{
    public function __construct(private FirebaseAdminRest $db, private string $projectId) {}
    private function invoke(string $method,string $uid,array $data=[]): array
    {
        $config=firebase_backend_config();
        $node=getenv('TICKSECURE_NODE_PATH') ?: (PHP_OS_FAMILY==='Windows'?'C:/Program Files/nodejs/node.exe':'node');
        $command=[$node,__DIR__.'/../functions/blockchain-php-bridge.js'];
        $pipes=[];$process=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,__DIR__.'/../functions',null,['bypass_shell'=>true,'create_no_window'=>true]);
        if(!is_resource($process))throw new FirebaseBackendException(503,'The blockchain server process could not start.','unavailable');
        fwrite($pipes[0],json_encode(['method'=>$method,'uid'=>$uid,'projectId'=>$this->projectId,'serviceAccountPath'=>$config['serviceAccountPath'],'data'=>$data],JSON_THROW_ON_ERROR));fclose($pipes[0]);
        $output=stream_get_contents($pipes[1]);fclose($pipes[1]);$stderr=stream_get_contents($pipes[2]);fclose($pipes[2]);proc_close($process);
        $result=json_decode($output,true);
        if(!is_array($result))throw new FirebaseBackendException(503,'The blockchain server could not complete the request. Check Node.js and the server dependencies.','unavailable');
        if(isset($result['error'])){
            $error=$result['error'];$code=$error['code']??'unavailable';$status=['permission-denied'=>403,'not-found'=>404,'invalid-argument'=>400,'failed-precondition'=>412,'unavailable'=>503][$code]??503;
            throw new FirebaseBackendException($status,$error['message']??'Blockchain request failed.',$code);
        }
        return $result['data']??[];
    }
    public function getSettings(string $uid): array { return $this->invoke('getSettings',$uid); }
    public function configure(string $uid,array $data): array { return $this->invoke('configure',$uid,$data); }
    public function prepare(string $uid,array $data): array { return $this->invoke('prepare',$uid,$data); }
    public function verify(string $uid,array $data): array { return $this->invoke('verify',$uid,$data); }
    public function listBuyer(string $uid,array $data): array { return $this->invoke('listBuyer',$uid,$data); }
    public function listOrganizer(string $uid,array $data): array { return $this->invoke('listOrganizer',$uid,$data); }
}
