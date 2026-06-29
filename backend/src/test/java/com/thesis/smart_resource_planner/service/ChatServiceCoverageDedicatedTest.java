package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.MessageType;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.*;
import com.thesis.smart_resource_planner.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatService Coverage Dedicated Tests")
class ChatServiceCoverageDedicatedTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private EmployeeRepository employeeRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private ModelMapper modelMapper;
    @Mock
    private WebSocketBroadcastService broadcastService;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private ChatRoomMemberRepository chatRoomMemberRepository;

    @InjectMocks
    private ChatService chatService;

    private User creator;
    private Company company;

    @BeforeEach
    void setUp() {
        company = new Company();
        company.setId(UUID.randomUUID());

        creator = new User();
        creator.setId(UUID.randomUUID());
        creator.setUsername("creatorUser");
        creator.setCompany(company);
        creator.setRole(UserRole.ADMIN);
    }

    @Test
    @DisplayName("sendMessage validation fails when no destination is provided")
    void sendMessage_noDestination() {
        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("Hello");

        when(userRepository.findById(creator.getId())).thenReturn(Optional.of(creator));

        assertThrows(BadRequestException.class, () -> chatService.sendMessage(dto, creator.getId()));
    }

    @Test
    @DisplayName("sendMessage for ChatRoom validation fails when user is not a member")
    void sendMessage_chatRoomNotMember() {
        UUID roomId = UUID.randomUUID();
        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("Hello Room");
        dto.setChatRoomId(roomId);

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setMembers(new ArrayList<>()); // Empty members list

        when(userRepository.findById(creator.getId())).thenReturn(Optional.of(creator));
        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));

        assertThrows(BadRequestException.class, () -> chatService.sendMessage(dto, creator.getId()));
    }

    @Test
    @DisplayName("sendMessage for ChatRoom broadcasts successfully when user is a member")
    void sendMessage_chatRoomSuccess() {
        UUID roomId = UUID.randomUUID();
        ChatMessageCreateDTO dto = new ChatMessageCreateDTO();
        dto.setMessage("Hello Room");
        dto.setChatRoomId(roomId);

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setCreator(creator);
        chatRoom.setName("Project Room");

        ChatRoomMember member = new ChatRoomMember();
        member.setUser(creator);
        member.setChatRoom(chatRoom);
        chatRoom.setMembers(List.of(member));

        ChatMessage message = ChatMessage.builder()
                .sender(creator)
                .message("Hello Room")
                .chatRoom(chatRoom)
                .build();

        ChatMessageDTO mappedDto = new ChatMessageDTO();
        mappedDto.setMessage("Hello Room");

        when(userRepository.findById(creator.getId())).thenReturn(Optional.of(creator));
        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));
        when(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).thenReturn(message);
        when(modelMapper.map(any(), eq(ChatMessageDTO.class))).thenReturn(mappedDto);

        ChatMessageDTO result = chatService.sendMessage(dto, creator.getId());
        assertNotNull(result);
        verify(messagingTemplate).convertAndSendToUser(creator.getId().toString(), "/queue/messages", mappedDto);
    }

    @Test
    @DisplayName("createGroupChat creates chatroom and maps to DTO")
    void createGroupChat_success() {
        UUID memberId = UUID.randomUUID();
        User memberUser = new User();
        memberUser.setId(memberId);
        memberUser.setCompany(company);

        ChatRoomCreateDTO dto = new ChatRoomCreateDTO();
        dto.setName("Group Chat");
        dto.setMemberIds(List.of(creator.getId(), memberId));

        when(userRepository.findById(creator.getId())).thenReturn(Optional.of(creator));
        when(userRepository.findById(memberId)).thenReturn(Optional.of(memberUser));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatRoomDTO result = chatService.createGroupChat(dto, creator.getId());
        assertNotNull(result);
        assertEquals("Group Chat", result.getName());
    }

    @Test
    @DisplayName("renameGroupChat works for members")
    void renameGroupChat_success() {
        UUID roomId = UUID.randomUUID();
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setName("Old Name");
        chatRoom.setCreator(creator);

        ChatRoomMember member = new ChatRoomMember();
        member.setUser(creator);
        chatRoom.setMembers(List.of(member));

        ChatRoomRenameDTO renameDTO = new ChatRoomRenameDTO();
        renameDTO.setName("New Name");

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChatRoomDTO result = chatService.renameGroupChat(roomId, renameDTO, creator.getId());
        assertEquals("New Name", result.getName());
    }

    @Test
    @DisplayName("renameGroupChat throws BadRequestException for non-members")
    void renameGroupChat_nonMember() {
        UUID roomId = UUID.randomUUID();
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setMembers(new ArrayList<>());

        ChatRoomRenameDTO renameDTO = new ChatRoomRenameDTO();
        renameDTO.setName("New Name");

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));

        assertThrows(BadRequestException.class, () -> chatService.renameGroupChat(roomId, renameDTO, creator.getId()));
    }

    @Test
    @DisplayName("leaveGroupChat works for members and deletes room if empty")
    void leaveGroupChat_success() {
        UUID roomId = UUID.randomUUID();
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setCreator(creator);

        ChatRoomMember member = new ChatRoomMember();
        member.setUser(creator);
        chatRoom.setMembers(new ArrayList<>(List.of(member)));

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));

        chatService.leaveGroupChat(roomId, creator.getId());

        verify(chatRoomMemberRepository).delete(member);
        verify(chatRoomRepository).delete(chatRoom);
    }

    @Test
    @DisplayName("deleteGroupChat deletes chatroom if user is admin member")
    void deleteGroupChat_byAdminMember() {
        UUID roomId = UUID.randomUUID();
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        
        User otherCreator = new User();
        otherCreator.setId(UUID.randomUUID());
        chatRoom.setCreator(otherCreator);

        ChatRoomMember member = new ChatRoomMember();
        member.setUser(creator);
        member.setRole("ADMIN");
        chatRoom.setMembers(List.of(member));

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));

        chatService.deleteGroupChat(roomId, creator.getId());

        verify(chatRoomRepository).delete(chatRoom);
    }

    @Test
    @DisplayName("getGroupChats returns list of user rooms")
    void getGroupChats_success() {
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(UUID.randomUUID());
        chatRoom.setName("Room 1");
        chatRoom.setCreator(creator);

        ChatRoomMember membership = new ChatRoomMember();
        membership.setUser(creator);
        membership.setChatRoom(chatRoom);

        when(chatRoomMemberRepository.findByUserId(creator.getId())).thenReturn(List.of(membership));

        List<ChatRoomDTO> result = chatService.getGroupChats(creator.getId());
        assertEquals(1, result.size());
        assertEquals("Room 1", result.get(0).getName());
    }

    @Test
    @DisplayName("getGroupChatMessages throws BadRequestException for non-members")
    void getGroupChatMessages_nonMember() {
        UUID roomId = UUID.randomUUID();
        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setId(roomId);
        chatRoom.setMembers(new ArrayList<>());

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(chatRoom));

        assertThrows(BadRequestException.class, () -> chatService.getGroupChatMessages(roomId, creator.getId()));
    }
}
